package services

import (
	"encoding/json"
	"errors"

	"github.com/Butterski/homelab-builder/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BuildService struct {
	db *gorm.DB
}

func NewBuildService(db *gorm.DB) *BuildService {
	return &BuildService{db: db}
}

func (s *BuildService) Create(userID uuid.UUID, input SyncGraphInput) (*models.Build, error) {
	settingsJSON, _ := json.Marshal(input.Settings)

	build := &models.Build{
		UserID:    userID,
		Name:      input.Name,
		Thumbnail: input.Thumbnail,
		Settings:  settingsJSON,
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(build).Error; err != nil {
			return err
		}
		return s.syncGraph(tx, build.ID, input)
	})

	if err != nil {
		return nil, err
	}

	return s.GetByID(build.ID)
}

func (s *BuildService) Update(buildID uuid.UUID, userID uuid.UUID, input SyncGraphInput) (*models.Build, error) {
	var build models.Build
	if err := s.db.First(&build, "id = ?", buildID).Error; err != nil {
		return nil, err
	}

	if build.UserID != userID {
		return nil, errors.New("unauthorized")
	}

	settingsJSON, _ := json.Marshal(input.Settings)
	build.Name = input.Name
	build.Settings = settingsJSON
	if input.Thumbnail != "" {
		build.Thumbnail = input.Thumbnail
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&build).Error; err != nil {
			return err
		}
		return s.syncGraph(tx, build.ID, input)
	})

	if err != nil {
		return nil, err
	}

	return s.GetByID(buildID)
}

// remapK8sSettingsIDs rewrites k8s_members node_id/vm_id references using the
// provided old→new ID mapping. Returns the original bytes unchanged when no
// k8s_members key exists or nothing needs remapping.
func remapK8sSettingsIDs(settingsJSON []byte, idRemap map[string]string) []byte {
	var settings map[string]any
	if err := json.Unmarshal(settingsJSON, &settings); err != nil {
		return settingsJSON
	}
	membersRaw, ok := settings["k8s_members"]
	if !ok {
		return settingsJSON
	}
	members, ok := membersRaw.([]any)
	if !ok {
		return settingsJSON
	}

	changed := false
	for i, raw := range members {
		m, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		if nodeID, ok := m["node_id"].(string); ok {
			if newID, exists := idRemap[nodeID]; exists && newID != nodeID {
				m["node_id"] = newID
				changed = true
			}
		}
		if vmID, ok := m["vm_id"].(string); ok {
			if newID, exists := idRemap[vmID]; exists && newID != vmID {
				m["vm_id"] = newID
				changed = true
			}
		}
		members[i] = m
	}

	if !changed {
		return settingsJSON
	}
	settings["k8s_members"] = members
	out, err := json.Marshal(settings)
	if err != nil {
		return settingsJSON
	}
	return out
}

func (s *BuildService) syncGraph(tx *gorm.DB, buildID uuid.UUID, input SyncGraphInput) error {
	// 1. Delete existing nodes/edges/services (cleanup)
	if err := tx.Where("build_id = ?", buildID).Delete(&models.Edge{}).Error; err != nil {
		return err
	}
	if err := tx.Where("build_id = ?", buildID).Delete(&models.ServiceInstance{}).Error; err != nil {
		return err
	}
	if err := tx.Where("node_id IN (?)", tx.Model(&models.Node{}).Select("id").Where("build_id = ?", buildID)).Delete(&models.NodeComponent{}).Error; err != nil {
		return err
	}
	// Delete child nodes first (those with parent_id), then parent nodes
	if err := tx.Where("build_id = ? AND parent_id IS NOT NULL", buildID).Delete(&models.Node{}).Error; err != nil {
		return err
	}
	if err := tx.Where("build_id = ?", buildID).Delete(&models.Node{}).Error; err != nil {
		return err
	}

	idMap := make(map[string]uuid.UUID)
	compIdMap := make(map[string]uuid.UUID)

	// Separate parent nodes and child nodes (those with parent_id)
	var parentNodes []NodeDTO
	var childNodes []NodeDTO
	for _, n := range input.Nodes {
		if n.ParentID != nil && *n.ParentID != "" {
			childNodes = append(childNodes, n)
		} else {
			parentNodes = append(parentNodes, n)
		}
	}

	// 2. Insert parent nodes first
	for _, n := range parentNodes {
		if err := s.insertNode(tx, buildID, n, idMap, compIdMap); err != nil {
			return err
		}
	}

	// 3. Insert child nodes (VMs) — parent IDs are resolved from idMap
	for _, n := range childNodes {
		if err := s.insertNode(tx, buildID, n, idMap, compIdMap); err != nil {
			return err
		}
	}

	// 4. Insert Edges
	for _, le := range input.Edges {
		sourceUUID, ok1 := idMap[le.Source]
		targetUUID, ok2 := idMap[le.Target]

		if ok1 && ok2 {
			edge := models.Edge{
				BuildID:      buildID,
				SourceNodeID: sourceUUID,
				SourceHandle: le.SourceHandle,
				TargetNodeID: targetUUID,
				TargetHandle: le.TargetHandle,
				Type:         "ethernet",
				Speed:        le.Speed,
				Subnet:       le.Subnet,
			}
			if err := tx.Create(&edge).Error; err != nil {
				return err
			}
		}
	}

	// 5. Insert Service Instances
	for _, ls := range input.Services {
		catalogID, err := uuid.Parse(ls.ID)
		if err == nil {
			svc := models.ServiceInstance{
				BuildID:          buildID,
				CatalogServiceID: catalogID,
				Name:             ls.Name,
				Status:           "stopped",
			}
			if err := tx.Create(&svc).Error; err != nil {
				return err
			}
		}
	}

	// 6. Remap k8s_members node_id in settings to match newly created UUIDs
	remap := make(map[string]string, len(idMap))
	for oldID, newUUID := range idMap {
		remap[oldID] = newUUID.String()
	}
	var build models.Build
	if err := tx.Select("id", "settings").First(&build, "id = ?", buildID).Error; err == nil && len(build.Settings) > 0 {
		if updated := remapK8sSettingsIDs(build.Settings, remap); string(updated) != string(build.Settings) {
			if err := tx.Model(&build).Update("settings", updated).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *BuildService) insertNode(tx *gorm.DB, buildID uuid.UUID, n NodeDTO, idMap map[string]uuid.UUID, compIdMap map[string]uuid.UUID) error {
	var uid uuid.UUID
	if parsed, err := uuid.Parse(n.ID); err == nil {
		uid = parsed
	} else {
		uid = uuid.New()
	}
	idMap[n.ID] = uid

	if n.Details == nil {
		n.Details = make(map[string]any)
	}
	if n.SubnetMask != "" {
		n.Details["subnet_mask"] = n.SubnetMask
	}
	if n.Gateway != "" {
		n.Details["gateway"] = n.Gateway
	}
	detailsJSON, _ := json.Marshal(n.Details)

	node := models.Node{
		ID:          uid,
		BuildID:     buildID,
		Type:        n.Type,
		Name:        n.Name,
		X:           n.X,
		Y:           n.Y,
		IP:          n.IP,
		TailscaleIP: n.TailscaleIP,
		Site:        n.Site,
		Details:     detailsJSON,
	}
	if n.ParentID != nil && *n.ParentID != "" {
		if mappedID, ok := idMap[*n.ParentID]; ok {
			node.ParentID = &mappedID
		} else if parsed, err := uuid.Parse(*n.ParentID); err == nil {
			node.ParentID = &parsed
		}
	}

	if err := tx.Create(&node).Error; err != nil {
		return err
	}

	for _, comp := range n.InternalComponents {
		compUID := uuid.New()
		if parsed, err := uuid.Parse(comp.ID); err == nil {
			compUID = parsed
		}
		compIdMap[comp.ID] = compUID
		compDetailsJSON, _ := json.Marshal(comp.Details)
		cModel := models.NodeComponent{
			ID:      compUID,
			NodeID:  uid,
			Type:    comp.Type,
			Name:    comp.Name,
			Details: compDetailsJSON,
		}
		if err := tx.Create(&cModel).Error; err != nil {
			return err
		}
	}

	return nil
}

func (s *BuildService) GetByID(buildID uuid.UUID) (*models.Build, error) {
	var build models.Build
	if err := s.db.Preload("User").
		Preload("Nodes").
		Preload("Nodes.InternalComponents").
		Preload("Edges").
		Preload("Nodes.ServiceInstances").
		First(&build, "id = ?", buildID).Error; err != nil {
		return nil, err
	}
	return &build, nil
}

type SyncGraphInput struct {
	Name      string         `json:"name" binding:"required"`
	Thumbnail string         `json:"thumbnail"`
	Settings  map[string]any `json:"settings"`
	Nodes     []NodeDTO      `json:"nodes"`
	Edges     []EdgeDTO      `json:"edges"`
	Services  []ServiceDTO   `json:"services"`
}

type NodeDTO struct {
	ID                 string         `json:"id"`
	Type               string         `json:"type"`
	Name               string         `json:"name"`
	X                  float64        `json:"x"`
	Y                  float64        `json:"y"`
	IP                 string         `json:"ip"`
	TailscaleIP        string         `json:"tailscale_ip,omitempty"`
	Site               string         `json:"site,omitempty"`
	SubnetMask         string         `json:"subnet_mask,omitempty"`
	Gateway            string         `json:"gateway,omitempty"`
	Details            map[string]any `json:"details"`
	InternalComponents []ComponentDTO `json:"internal_components"`
	ParentID           *string        `json:"parent_id,omitempty"`
}

type ComponentDTO struct {
	ID      string         `json:"id"`
	Type    string         `json:"type"`
	Name    string         `json:"name"`
	Details map[string]any `json:"details"`
}

type ServiceDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type EdgeDTO struct {
	Source       string `json:"source"`
	SourceHandle string `json:"source_handle"`
	Target       string `json:"target"`
	TargetHandle string `json:"target_handle"`
	Speed        string `json:"speed"`
	Subnet       string `json:"subnet"`
}

func (s *BuildService) ListByUser(userID uuid.UUID) ([]models.Build, error) {
	var builds []models.Build
	if err := s.db.Preload("Nodes").Where("user_id = ?", userID).Order("updated_at desc").Find(&builds).Error; err != nil {
		return nil, err
	}
	return builds, nil
}

func (s *BuildService) Delete(buildID uuid.UUID, userID uuid.UUID) error {
	result := s.db.Where("id = ? AND user_id = ?", buildID, userID).Delete(&models.Build{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("build not found or unauthorized")
	}
	return nil
}

func (s *BuildService) Duplicate(buildID uuid.UUID, userID uuid.UUID) (*models.Build, error) {
	// First fetch the full build that we want to copy
	build, err := s.GetByID(buildID)
	if err != nil {
		return nil, err
	}

	if build.UserID != userID {
		return nil, errors.New("unauthorized to duplicate this build")
	}

	// Create a new independent copy with a new UUID
	newBuild := &models.Build{
		UserID:    userID,
		Name:      build.Name + " (Copy)",
		Thumbnail: build.Thumbnail,
		Settings:  build.Settings,
	}

	// Start a transaction to insert the new build and sync its data
	err = s.db.Transaction(func(tx *gorm.DB) error {
		// Insert the new base build row to get its ID
		if err := tx.Create(newBuild).Error; err != nil {
			return err
		}

		// Relational Clone:
		idMap := make(map[uuid.UUID]uuid.UUID)

		// Separate parent nodes and child nodes (VMs with parent_id)
		var parentNodeList []models.Node
		var childNodeList []models.Node
		for _, node := range build.Nodes {
			if node.ParentID != nil {
				childNodeList = append(childNodeList, node)
			} else {
				parentNodeList = append(parentNodeList, node)
			}
		}

		// 1. Clone parent nodes first
		for _, node := range parentNodeList {
			newUID := uuid.New()
			idMap[node.ID] = newUID

			newNode := models.Node{
				ID:          newUID,
				BuildID:     newBuild.ID,
				Type:        node.Type,
				Name:        node.Name,
				X:           node.X,
				Y:           node.Y,
				IP:          node.IP,
				TailscaleIP: node.TailscaleIP,
				Site:        node.Site,
				Details:     node.Details,
			}
			if err := tx.Create(&newNode).Error; err != nil {
				return err
			}

			for _, comp := range node.InternalComponents {
				newComp := comp
				newComp.ID = uuid.New()
				newComp.NodeID = newUID
				if err := tx.Create(&newComp).Error; err != nil {
					return err
				}
			}

			for _, svc := range node.ServiceInstances {
				newSvc := svc
				newSvc.ID = uuid.New()
				newSvc.BuildID = newBuild.ID
				nodeIDPtr := newUID
				newSvc.NodeID = &nodeIDPtr
				if err := tx.Create(&newSvc).Error; err != nil {
					return err
				}
			}
		}

		// 1b. Clone child nodes (VMs) — remap parent_id
		for _, node := range childNodeList {
			newUID := uuid.New()
			idMap[node.ID] = newUID

			newNode := models.Node{
				ID:          newUID,
				BuildID:     newBuild.ID,
				Type:        node.Type,
				Name:        node.Name,
				X:           node.X,
				Y:           node.Y,
				IP:          node.IP,
				TailscaleIP: node.TailscaleIP,
				Site:        node.Site,
				Details:     node.Details,
			}
			if node.ParentID != nil {
				if mappedParent, ok := idMap[*node.ParentID]; ok {
					newNode.ParentID = &mappedParent
				}
			}
			if err := tx.Create(&newNode).Error; err != nil {
				return err
			}

			for _, comp := range node.InternalComponents {
				newComp := comp
				newComp.ID = uuid.New()
				newComp.NodeID = newUID
				if err := tx.Create(&newComp).Error; err != nil {
					return err
				}
			}
		}

		// 2. Clone Edges
		for _, edge := range build.Edges {
			sourceUUID, ok1 := idMap[edge.SourceNodeID]
			targetUUID, ok2 := idMap[edge.TargetNodeID]

			if ok1 && ok2 {
				newEdge := models.Edge{
					ID:           uuid.New(),
					BuildID:      newBuild.ID,
					SourceNodeID: sourceUUID,
					SourceHandle: edge.SourceHandle,
					TargetNodeID: targetUUID,
					TargetHandle: edge.TargetHandle,
					Type:         edge.Type,
					Speed:        edge.Speed,
					Subnet:       edge.Subnet,
				}
				if err := tx.Create(&newEdge).Error; err != nil {
					return err
				}
			}
		}

		// 3. Clone Global Service Instances (Backlog / NodeID is null)
		var globalServices []models.ServiceInstance
		if err := tx.Where("build_id = ? AND node_id IS NULL", buildID).Find(&globalServices).Error; err == nil {
			for _, svc := range globalServices {
				newSvc := svc
				newSvc.ID = uuid.New()
				newSvc.BuildID = newBuild.ID
				if err := tx.Create(&newSvc).Error; err != nil {
					return err
				}
			}
		}

		// Remap k8s_members node_id in settings to match cloned UUIDs
		if len(newBuild.Settings) > 0 {
			remap := make(map[string]string, len(idMap))
			for oldUUID, newUUID := range idMap {
				remap[oldUUID.String()] = newUUID.String()
			}
			if updated := remapK8sSettingsIDs(newBuild.Settings, remap); string(updated) != string(newBuild.Settings) {
				newBuild.Settings = updated
				if err := tx.Model(newBuild).Update("settings", updated).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return s.GetByID(newBuild.ID)
}
