package api

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/kr4t0n/orbit/ipam/internal/core"
	"github.com/kr4t0n/orbit/ipam/internal/models"
)

// RegisterRoutes wires the IPAM endpoints onto the provided mux.
func RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/allocate", handleAllocate)
	mux.HandleFunc("POST /api/v1/validate", handleValidate)
	mux.HandleFunc("GET /health", handleHealth)
}

func handleAllocate(w http.ResponseWriter, r *http.Request) {
	var req models.AllocateRequest
	if err := decodeBody(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	result := core.Allocate(req)
	writeJSON(w, http.StatusOK, result)
}

func handleValidate(w http.ResponseWriter, r *http.Request) {
	var req models.AllocateRequest
	if err := decodeBody(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	result := core.Validate(req)
	writeJSON(w, http.StatusOK, result)
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func decodeBody(r *http.Request, dst interface{}) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return err
	}
	return json.Unmarshal(body, dst)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}
