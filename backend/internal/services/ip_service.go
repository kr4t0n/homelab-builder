package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"time"

	"github.com/kr4t0n/orbit/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IPService proxies IP calculation requests to the IPAM microservice
// and persists results back into the database.
type IPService struct {
	db      *gorm.DB
	client  *http.Client
	ipamURL string
}

func NewIPService(db *gorm.DB) *IPService {
	url := os.Getenv("IPAM_URL")
	if url == "" {
		url = "http://localhost:8081"
	}
	return &IPService{
		db:      db,
		client:  &http.Client{Timeout: 10 * time.Second},
		ipamURL: url,
	}
}

// ── IPAM request/response DTOs ──────────────────────────────────────────

type ipamRouter struct {
	ID          string `json:"id"`
	GatewayIP   string `json:"gateway_ip,omitempty"`
	Subnet      string `json:"subnet,omitempty"`
	DHCPEnabled bool   `json:"dhcp_enabled,omitempty"`
}

type ipamVM struct {
	ID         string `json:"id"`
	ExistingIP string `json:"existing_ip,omitempty"`
}

type ipamNode struct {
	ID          string   `json:"id"`
	Type        string   `json:"type"`
	Connections []string `json:"connections"`
	ExistingIP  string   `json:"existing_ip,omitempty"`
	VMs         []ipamVM `json:"vms,omitempty"`
}

type ipamRequest struct {
	Routers []ipamRouter `json:"routers"`
	Nodes   []ipamNode   `json:"nodes"`
}

type ipamVMResult struct {
	ID         string `json:"id"`
	AssignedIP string `json:"assigned_ip"`
}

type ipamNodeResult struct {
	ID         string         `json:"id"`
	Type       string         `json:"type"`
	AssignedIP string         `json:"assigned_ip"`
	VMs        []ipamVMResult `json:"vms,omitempty"`
}

type ipamRouterResult struct {
	ID        string `json:"id"`
	GatewayIP string `json:"gateway_ip"`
	Subnet    string `json:"subnet"`
}

type ipamResponse struct {
	Routers []ipamRouterResult `json:"routers"`
	Nodes   []ipamNodeResult   `json:"nodes"`
}

// ─── Non-network types that don't receive IPs ───────────────────────────────

var nonNetworkTypes = map[string]bool{
	"disk": true, "gpu": true, "hba": true, "pcie": true, "pdu": true, "ups": true,
}

// ─── Public API ─────────────────────────────────────────────────────────────

// CalculateNetwork loads the build's topology from the DB, sends it to
// IPAM for allocation, and writes the assigned IPs back.
func (s *IPService) CalculateNetwork(buildID uuid.UUID) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. Load all nodes
		var allNodes []models.Node
		if err := tx.Where("build_id = ?", buildID).Find(&allNodes).Error; err != nil {
			return err
		}
		if len(allNodes) == 0 {
			return nil
		}

		var edges []models.Edge
		if err := tx.Where("build_id = ?", buildID).Find(&edges).Error; err != nil {
			return err
		}

		// Separate parent nodes and child nodes (VMs have parent_id set)
		var nodes []models.Node
		childByParent := make(map[string][]models.Node)
		for _, n := range allNodes {
			if n.ParentID != nil {
				pid := n.ParentID.String()
				childByParent[pid] = append(childByParent[pid], n)
			} else {
				nodes = append(nodes, n)
			}
		}

		extractPort := func(h string) int {
			var numStr string
			for _, c := range h {
				if c >= '0' && c <= '9' {
					numStr += string(c)
				}
			}
			if numStr == "" {
				return 0
			}
			val, _ := strconv.Atoi(numStr)
			return val
		}

		// 2. Build adjacency from edges (only parent nodes participate)
		adj := make(map[string][]string, len(nodes))
		edgePorts := make(map[string]map[string]int, len(nodes))

		for _, e := range edges {
			src := e.SourceNodeID.String()
			tgt := e.TargetNodeID.String()
			adj[src] = append(adj[src], tgt)
			adj[tgt] = append(adj[tgt], src)

			if edgePorts[src] == nil {
				edgePorts[src] = make(map[string]int)
			}
			if edgePorts[tgt] == nil {
				edgePorts[tgt] = make(map[string]int)
			}

			edgePorts[src][tgt] = extractPort(e.SourceHandle)
			edgePorts[tgt][src] = extractPort(e.TargetHandle)
		}

		for nodeID, neighbors := range adj {
			sort.Slice(neighbors, func(i, j int) bool {
				p1 := edgePorts[nodeID][neighbors[i]]
				p2 := edgePorts[nodeID][neighbors[j]]
				return p1 < p2
			})
		}

		// 3. Build IPAM request — convert child nodes into ipamVM structs
		req := ipamRequest{
			Routers: make([]ipamRouter, 0),
			Nodes:   make([]ipamNode, 0, len(nodes)),
		}

		for _, n := range nodes {
			nid := n.ID.String()
			if n.Type == "router" {
				var details struct {
					DHCPEnabled bool   `json:"dhcp_enabled"`
					SubnetMask  string `json:"subnet_mask"`
				}
				_ = json.Unmarshal(n.Details, &details)

				subnet := ""
				if n.IP != "" && details.SubnetMask != "" {
					subnet = n.IP + "/" + details.SubnetMask
				}

				req.Routers = append(req.Routers, ipamRouter{
					ID:          nid,
					GatewayIP:   n.IP,
					Subnet:      subnet,
					DHCPEnabled: details.DHCPEnabled,
				})
			}

			// Convert child nodes to ipamVM format
			children := childByParent[nid]
			vms := make([]ipamVM, 0, len(children))
			for _, child := range children {
				vms = append(vms, ipamVM{
					ID:         child.ID.String(),
					ExistingIP: child.IP,
				})
			}

			existingIP := ""
			var details struct {
				DHCPLocked bool `json:"dhcp_locked"`
			}
			_ = json.Unmarshal(n.Details, &details)

			if nonNetworkTypes[n.Type] {
				// Don't send existing IP for non-network types
			} else if n.Type == "router" {
				existingIP = n.IP
			} else if details.DHCPLocked {
				existingIP = n.IP
			}

			req.Nodes = append(req.Nodes, ipamNode{
				ID:          nid,
				Type:        n.Type,
				Connections: adj[nid],
				ExistingIP:  existingIP,
				VMs:         vms,
			})
		}

		// 4. Call IPAM
		result, err := s.callIPAM(req)
		if err != nil {
			return fmt.Errorf("IPAM call failed: %w", err)
		}

		// 5. Build a lookup from IPAM results
		ipByID := make(map[string]string, len(result.Nodes))
		vmIPByID := make(map[string]string)
		for _, nr := range result.Nodes {
			if nr.AssignedIP != "" {
				ipByID[nr.ID] = nr.AssignedIP
			}
			for _, vmr := range nr.VMs {
				if vmr.AssignedIP != "" {
					vmIPByID[vmr.ID] = vmr.AssignedIP
				}
			}
		}

		routerIPByID := make(map[string]string, len(result.Routers))
		for _, rr := range result.Routers {
			if rr.GatewayIP != "" {
				routerIPByID[rr.ID] = rr.GatewayIP
			}
		}

		// 6. Persist assigned LAN IPs on parent nodes
		for i := range nodes {
			nid := nodes[i].ID.String()
			if ip, ok := ipByID[nid]; ok {
				nodes[i].IP = ip
			}
			if ip, ok := routerIPByID[nid]; ok {
				nodes[i].IP = ip
			}
			if err := tx.Save(&nodes[i]).Error; err != nil {
				return err
			}
		}

		// 7. Persist assigned LAN IPs on child nodes (VMs)
		for _, children := range childByParent {
			for i := range children {
				cid := children[i].ID.String()
				if ip, ok := vmIPByID[cid]; ok {
					children[i].IP = ip
				}
				if err := tx.Save(&children[i]).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})
}

// callIPAM sends a topology to the IPAM /allocate endpoint and returns the result.
func (s *IPService) callIPAM(req ipamRequest) (*ipamResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := s.ipamURL + "/api/v1/allocate"
	log.Printf("Calling IPAM at %s (%d routers, %d nodes)", url, len(req.Routers), len(req.Nodes))

	resp, err := s.client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("POST %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("IPAM returned %d: %s", resp.StatusCode, string(errBody))
	}

	var result ipamResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

// ValidateNetwork sends the current topology to the IPAM validate endpoint
// and returns the raw validation response directly to the caller.
func (s *IPService) ValidateNetwork(buildID uuid.UUID) (json.RawMessage, error) {
	var allNodes []models.Node
	if err := s.db.Where("build_id = ?", buildID).Find(&allNodes).Error; err != nil {
		return nil, err
	}

	var edges []models.Edge
	if err := s.db.Where("build_id = ?", buildID).Find(&edges).Error; err != nil {
		return nil, err
	}

	// Separate parent nodes and child nodes
	var nodes []models.Node
	childByParent := make(map[string][]models.Node)
	for _, n := range allNodes {
		if n.ParentID != nil {
			pid := n.ParentID.String()
			childByParent[pid] = append(childByParent[pid], n)
		} else {
			nodes = append(nodes, n)
		}
	}

	adj := make(map[string][]string, len(nodes))
	for _, e := range edges {
		src := e.SourceNodeID.String()
		tgt := e.TargetNodeID.String()
		adj[src] = append(adj[src], tgt)
		adj[tgt] = append(adj[tgt], src)
	}

	req := ipamRequest{
		Routers: make([]ipamRouter, 0),
		Nodes:   make([]ipamNode, 0, len(nodes)),
	}

	for _, n := range nodes {
		nid := n.ID.String()
		if n.Type == "router" {
			var details struct {
				DHCPEnabled bool `json:"dhcp_enabled"`
			}
			_ = json.Unmarshal(n.Details, &details)

			req.Routers = append(req.Routers, ipamRouter{
				ID:          nid,
				GatewayIP:   n.IP,
				DHCPEnabled: details.DHCPEnabled,
			})
		}

		children := childByParent[nid]
		vms := make([]ipamVM, 0, len(children))
		for _, child := range children {
			vms = append(vms, ipamVM{
				ID:         child.ID.String(),
				ExistingIP: child.IP,
			})
		}

		req.Nodes = append(req.Nodes, ipamNode{
			ID:          nid,
			Type:        n.Type,
			Connections: adj[nid],
			ExistingIP:  n.IP,
			VMs:         vms,
		})
	}

	payload, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal validation payload: %w", err)
	}

	resp, err := s.client.Post(s.ipamURL+"/api/v1/validate", "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to call IPAM validate: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ipam service returned %d: %s", resp.StatusCode, string(body))
	}

	rawResp, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read validation response: %w", err)
	}

	return json.RawMessage(rawResp), nil
}

// FallbackCalculateNetwork is kept as a safety net — if IPAM is unreachable,
// the system can fall back to this inline implementation.
// Currently unused; wire it in if you need offline resilience.
func (s *IPService) FallbackCalculateNetwork(buildID uuid.UUID) error {
	return errors.New("IPAM service unavailable and no fallback configured")
}
