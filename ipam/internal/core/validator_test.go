package core

import (
	"testing"

	"github.com/kr4t0n/orbit/ipam/internal/models"
)

func TestValidate_ValidTopology(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1"},
		},
		Nodes: []models.NodeDTO{
			{ID: "sw1", Type: "switch", Connections: []string{"r1"}, ExistingIP: "192.168.1.10"},
			{ID: "srv1", Type: "server", Connections: []string{"sw1"}, ExistingIP: "192.168.1.150"},
		},
	}

	resp := Validate(req)
	if !resp.Valid {
		t.Errorf("expected valid, got errors: %v", resp.Errors)
	}
}

func TestValidate_DuplicateIP(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1"},
		},
		Nodes: []models.NodeDTO{
			{ID: "sw1", Type: "switch", Connections: []string{"r1"}, ExistingIP: "192.168.1.10"},
			{ID: "sw2", Type: "switch", Connections: []string{"r1"}, ExistingIP: "192.168.1.10"},
		},
	}

	resp := Validate(req)
	if resp.Valid {
		t.Fatal("expected invalid due to duplicate IP")
	}
	found := false
	for _, e := range resp.Errors {
		if e.NodeID == "sw2" {
			found = true
		}
	}
	if !found {
		t.Error("expected conflict error for sw2")
	}
}

func TestValidate_WrongSubnet(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1"},
		},
		Nodes: []models.NodeDTO{
			{ID: "srv1", Type: "server", Connections: []string{"r1"}, ExistingIP: "10.0.0.150"},
		},
	}

	resp := Validate(req)
	if resp.Valid {
		t.Fatal("expected invalid: IP in wrong subnet")
	}
}

func TestValidate_DHCPConflict(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1", DHCPEnabled: true},
		},
		Nodes: []models.NodeDTO{
			{ID: "srv1", Type: "server", Connections: []string{"r1"}, ExistingIP: "192.168.1.50"},
		},
	}

	resp := Validate(req)
	if resp.Valid {
		t.Fatal("expected invalid: IP in DHCP range")
	}
}

func TestValidate_InvalidIPv4(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1"},
		},
		Nodes: []models.NodeDTO{
			{ID: "srv1", Type: "server", Connections: []string{"r1"}, ExistingIP: "not-an-ip"},
		},
	}

	resp := Validate(req)
	if resp.Valid {
		t.Fatal("expected invalid: bad IP format")
	}
}

func TestValidate_VMDuplicateWithHost(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1"},
		},
		Nodes: []models.NodeDTO{
			{ID: "srv1", Type: "server", Connections: []string{"r1"}, ExistingIP: "192.168.1.150",
				VMs: []models.VMDTO{{ID: "vm1", ExistingIP: "192.168.1.150"}}},
		},
	}

	resp := Validate(req)
	if resp.Valid {
		t.Fatal("expected invalid: VM has same IP as host")
	}
}

func TestValidate_GatewayConflict(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1"},
		},
		Nodes: []models.NodeDTO{
			{ID: "srv1", Type: "server", Connections: []string{"r1"}, ExistingIP: "192.168.1.1"},
		},
	}

	resp := Validate(req)
	if resp.Valid {
		t.Fatal("expected invalid: node uses gateway IP")
	}
}
