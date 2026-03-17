package services

import (
	"crypto/rand"
	"fmt"
	"strings"

	"github.com/kr4t0n/orbit/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ConfigService struct {
	db *gorm.DB
}

func NewConfigService(db *gorm.DB) *ConfigService {
	return &ConfigService{db: db}
}

type ServiceConfig struct {
	Image   string
	Ports   []string
	Volumes []string
	Env     []string
}

// Hardcoded library mirroring the frontend typescript map
var serviceImages = map[string]ServiceConfig{
	"plex":                {Image: "plexinc/pms-docker:latest", Ports: []string{"32400:32400"}, Volumes: []string{"plex_config:/config", "plex_media:/media"}, Env: []string{"PLEX_CLAIM="}},
	"jellyfin":            {Image: "jellyfin/jellyfin:latest", Ports: []string{"8096:8096"}, Volumes: []string{"jellyfin_config:/config", "jellyfin_media:/media"}, Env: []string{}},
	"sonarr":              {Image: "linuxserver/sonarr:latest", Ports: []string{"8989:8989"}, Volumes: []string{"sonarr_config:/config", "media:/tv"}, Env: []string{"PUID=1000", "PGID=1000"}},
	"radarr":              {Image: "linuxserver/radarr:latest", Ports: []string{"7878:7878"}, Volumes: []string{"radarr_config:/config", "media:/movies"}, Env: []string{"PUID=1000", "PGID=1000"}},
	"prowlarr":            {Image: "linuxserver/prowlarr:latest", Ports: []string{"9696:9696"}, Volumes: []string{"prowlarr_config:/config"}, Env: []string{"PUID=1000", "PGID=1000"}},
	"qbittorrent":         {Image: "linuxserver/qbittorrent:latest", Ports: []string{"8080:8080", "6881:6881"}, Volumes: []string{"qbt_config:/config", "downloads:/downloads"}, Env: []string{"PUID=1000", "PGID=1000"}},
	"portainer":           {Image: "portainer/portainer-ce:latest", Ports: []string{"9000:9000", "9443:9443"}, Volumes: []string{"/var/run/docker.sock:/var/run/docker.sock", "portainer_data:/data"}, Env: []string{}},
	"nginx-proxy-manager": {Image: "jc21/nginx-proxy-manager:latest", Ports: []string{"80:80", "443:443", "81:81"}, Volumes: []string{"npm_data:/data", "npm_letsencrypt:/etc/letsencrypt"}, Env: []string{}},
	"traefik":             {Image: "traefik:v3.0", Ports: []string{"80:80", "443:443", "8080:8080"}, Volumes: []string{"/var/run/docker.sock:/var/run/docker.sock", "traefik_certs:/certs"}, Env: []string{}},
	"grafana":             {Image: "grafana/grafana:latest", Ports: []string{"3000:3000"}, Volumes: []string{"grafana_data:/var/lib/grafana"}, Env: []string{"GF_SECURITY_ADMIN_PASSWORD=changeme"}},
	"prometheus":          {Image: "prom/prometheus:latest", Ports: []string{"9090:9090"}, Volumes: []string{"prometheus_data:/prometheus", "./prometheus.yml:/etc/prometheus/prometheus.yml:ro"}, Env: []string{}},
	"home-assistant":      {Image: "ghcr.io/home-assistant/home-assistant:stable", Ports: []string{"8123:8123"}, Volumes: []string{"ha_config:/config"}, Env: []string{}},
	"nextcloud":           {Image: "nextcloud:latest", Ports: []string{"8080:80"}, Volumes: []string{"nextcloud_data:/var/www/html"}, Env: []string{"MYSQL_HOST=db", "MYSQL_DATABASE=nextcloud", "MYSQL_USER=nextcloud", "MYSQL_PASSWORD=changeme"}},
	"vaultwarden":         {Image: "vaultwarden/server:latest", Ports: []string{"8080:80"}, Volumes: []string{"vaultwarden_data:/data"}, Env: []string{"ADMIN_TOKEN=changeme"}},
	"gitea":               {Image: "gitea/gitea:latest", Ports: []string{"3000:3000", "2222:22"}, Volumes: []string{"gitea_data:/data"}, Env: []string{}},
	"pi-hole":             {Image: "pihole/pihole:latest", Ports: []string{"53:53/tcp", "53:53/udp", "80:80"}, Volumes: []string{"pihole_etc:/etc/pihole", "pihole_dnsmasq:/etc/dnsmasq.d"}, Env: []string{"WEBPASSWORD=changeme"}},
	"adguard-home":        {Image: "adguard/adguardhome:latest", Ports: []string{"53:53/tcp", "53:53/udp", "3000:3000", "80:80"}, Volumes: []string{"adguard_work:/opt/adguardhome/work", "adguard_conf:/opt/adguardhome/conf"}, Env: []string{}},
	"uptime-kuma":         {Image: "louislam/uptime-kuma:latest", Ports: []string{"3001:3001"}, Volumes: []string{"uptime_kuma_data:/app/data"}, Env: []string{}},
	"immich":              {Image: "ghcr.io/immich-app/immich-server:release", Ports: []string{"2283:3001"}, Volumes: []string{"immich_upload:/usr/src/app/upload"}, Env: []string{"DB_PASSWORD=changeme", "REDIS_HOSTNAME=redis"}},
	"paperless-ngx":       {Image: "ghcr.io/paperless-ngx/paperless-ngx:latest", Ports: []string{"8000:8000"}, Volumes: []string{"paperless_data:/usr/src/paperless/data", "paperless_media:/usr/src/paperless/media"}, Env: []string{"PAPERLESS_SECRET_KEY=changeme"}},
	"code-server":         {Image: "codercom/code-server:latest", Ports: []string{"8443:8080"}, Volumes: []string{"code_server_data:/home/coder"}, Env: []string{"PASSWORD=changeme"}},
	"bytebase":            {Image: "bytebase/bytebase:latest", Ports: []string{"5678:5678"}, Volumes: []string{"bytebase_data:/var/opt/bytebase"}, Env: []string{}},
	"mariadb":             {Image: "mariadb:latest", Ports: []string{"3306:3306"}, Volumes: []string{"mariadb_data:/var/lib/mysql"}, Env: []string{"MYSQL_ROOT_PASSWORD=changeme"}},
	"postgres":            {Image: "postgres:17", Ports: []string{"5432:5432"}, Volumes: []string{"postgres_data:/var/lib/postgresql/data"}, Env: []string{"POSTGRES_PASSWORD=changeme"}},
	"calibre-web":         {Image: "linuxserver/calibre-web:latest", Ports: []string{"8083:8083"}, Volumes: []string{"calibre_config:/config", "calibre_books:/books"}, Env: []string{"PUID=1000", "PGID=1000"}},
	"kikoeru":             {Image: "nortonandrews/kikoeru:latest", Ports: []string{"8888:8888"}, Volumes: []string{"kikoeru_data:/app/data"}, Env: []string{}},
	"photoprism":          {Image: "photoprism/photoprism:latest", Ports: []string{"2342:2342"}, Volumes: []string{"photoprism_storage:/photoprism/storage", "photoprism_originals:/photoprism/originals"}, Env: []string{"PHOTOPRISM_ADMIN_PASSWORD=changeme"}},
	"tautulli":            {Image: "tautulli/tautulli:latest", Ports: []string{"8181:8181"}, Volumes: []string{"tautulli_config:/config"}, Env: []string{}},
	"kite":                {Image: "nickvdyck/kite:latest", Ports: []string{"3200:3000"}, Volumes: []string{"kite_data:/data"}, Env: []string{}},
	"vault":               {Image: "hashicorp/vault:latest", Ports: []string{"8200:8200"}, Volumes: []string{"vault_data:/vault/data"}, Env: []string{"VAULT_DEV_ROOT_TOKEN_ID=changeme"}},
	"velero":              {Image: "velero/velero:latest", Ports: []string{"8085:8085"}, Volumes: []string{"velero_data:/var/velero"}, Env: []string{}},
	"oauth2-proxy":        {Image: "quay.io/oauth2-proxy/oauth2-proxy:latest", Ports: []string{"4180:4180"}, Volumes: []string{}, Env: []string{"OAUTH2_PROXY_CLIENT_ID=", "OAUTH2_PROXY_CLIENT_SECRET=", "OAUTH2_PROXY_COOKIE_SECRET="}},
}

func getServiceConfig(name string) ServiceConfig {
	if cfg, ok := serviceImages[name]; ok {
		return cfg
	}
	// Fallback
	return ServiceConfig{
		Image:   fmt.Sprintf("%s:latest", name),
		Ports:   []string{"8080:8080"},
		Volumes: []string{fmt.Sprintf("%s_data:/data", name)},
		Env:     []string{},
	}
}

func randomSecret(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	rand.Read(b)
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b)
}

// GenerateDockerCompose generates a Docker Compose YAML string for a build ID
func (s *ConfigService) GenerateDockerCompose(buildID uuid.UUID) (string, error) {
	var build models.Build
	if err := s.db.Preload("Nodes").First(&build, "id = ?", buildID).Error; err != nil {
		return "", err
	}

	composeStr := "services:\n"

	hasVMs := false
	allVolumes := make(map[string]bool)
	var subnet string

	// Child nodes (VMs) are nodes with parent_id set
	for _, node := range build.Nodes {
		if node.Type == "router" && node.IP != "" && subnet == "" {
			parts := strings.Split(node.IP, ".")
			if len(parts) == 4 {
				subnet = fmt.Sprintf("%s.%s.%s.0/24", parts[0], parts[1], parts[2])
			}
		}

		if node.ParentID == nil {
			continue
		}

		hasVMs = true
		cfg := getServiceConfig(node.Name)
		slug := strings.ReplaceAll(strings.ToLower(node.Name), " ", "_")

		composeStr += fmt.Sprintf("  %s:\n", slug)
		composeStr += fmt.Sprintf("    image: %s\n", cfg.Image)
		composeStr += fmt.Sprintf("    container_name: %s\n", slug)
		composeStr += "    restart: unless-stopped\n"

		if len(cfg.Ports) > 0 {
			composeStr += "    ports:\n"
			for _, p := range cfg.Ports {
				composeStr += fmt.Sprintf("      - \"%s\"\n", p)
			}
		}

		if len(cfg.Volumes) > 0 {
			composeStr += "    volumes:\n"
			for _, v := range cfg.Volumes {
				composeStr += fmt.Sprintf("      - %s\n", v)
				name := strings.SplitN(v, ":", 2)[0]
				if !strings.HasPrefix(name, "/") && !strings.HasPrefix(name, ".") {
					allVolumes[name] = true
				}
			}
		}

		if len(cfg.Env) > 0 {
			composeStr += "    environment:\n"
			for _, e := range cfg.Env {
				composeStr += fmt.Sprintf("      - %s\n", e)
			}
		}

		if node.IP != "" {
			composeStr += "    networks:\n"
			composeStr += "      homelab_net:\n"
			composeStr += fmt.Sprintf("        ipv4_address: %s\n", node.IP)

			if subnet == "" {
				parts := strings.Split(node.IP, ".")
				if len(parts) == 4 {
					subnet = fmt.Sprintf("%s.%s.%s.0/24", parts[0], parts[1], parts[2])
				}
			}
		} else {
			composeStr += "    networks:\n"
			composeStr += "      - homelab_net\n"
		}
		composeStr += "\n"
	}

	if len(allVolumes) > 0 {
		composeStr += "volumes:\n"
		for vol := range allVolumes {
			composeStr += fmt.Sprintf("  %s:\n", vol)
		}
		composeStr += "\n"
	}

	if hasVMs {
		if subnet == "" {
			subnet = "192.168.1.0/24" // final fallback
		}
		composeStr += "networks:\n"
		composeStr += "  homelab_net:\n"
		composeStr += "    driver: bridge\n"
		composeStr += "    ipam:\n"
		composeStr += "      config:\n"
		composeStr += fmt.Sprintf("        - subnet: %s\n", subnet)
	}

	if !hasVMs {
		return "services: {}\n", nil
	}

	return composeStr, nil
}

// GenerateEnv generates a .env file string for the given build ID based on VMs requiring passwords/secrets
func (s *ConfigService) GenerateEnv(buildID uuid.UUID) (string, error) {
	var build models.Build
	if err := s.db.Preload("Nodes").First(&build, "id = ?", buildID).Error; err != nil {
		return "", err
	}

	envStr := "# Generated by Orbit\n"
	envStr += "HOMELAB_DOMAIN=homelab.local\n"
	envStr += "PUID=1000\n"
	envStr += "PGID=1000\n"
	envStr += "TZ=Europe/Warsaw\n\n"

	seen := make(map[string]bool)
	for _, node := range build.Nodes {
		if node.ParentID == nil {
			continue
		}

		cfg := getServiceConfig(node.Name)

		var relevant []string
		for _, e := range cfg.Env {
			if strings.Contains(e, "PASSWORD") || strings.Contains(e, "SECRET") || strings.Contains(e, "TOKEN") || strings.Contains(e, "KEY") {
				relevant = append(relevant, e)
			}
		}

		if len(relevant) == 0 {
			continue
		}

		envStr += fmt.Sprintf("# ── %s ──────────────────────────────────────────────────────────\n", node.Name)
		for _, e := range relevant {
			parts := strings.SplitN(e, "=", 2)
			key := parts[0]
			if !seen[key] {
				seen[key] = true
				isSecret := strings.Contains(key, "SECRET") || strings.Contains(key, "TOKEN") || strings.Contains(key, "KEY")
				val := "changeme_" + strings.ToLower(key)
				if isSecret {
					val = randomSecret(32)
				}
				envStr += fmt.Sprintf("%s=%s\n", key, val)
			}
		}
		envStr += "\n"
	}

	return envStr, nil
}

// GenerateAnsibleInventory generates an Ansible inventory string for the hardware nodes
func (s *ConfigService) GenerateAnsibleInventory(buildID uuid.UUID) (string, error) {
	var build models.Build
	if err := s.db.Preload("Nodes").First(&build, "id = ?", buildID).Error; err != nil {
		return "", err
	}

	invStr := "[homelab]\n"
	for _, node := range build.Nodes {
		if node.IP != "" {
			if node.ParentID != nil {
				invStr += fmt.Sprintf("%s ansible_host=%s ansible_user=ubuntu\n", node.Name, node.IP)
			} else {
				invStr += fmt.Sprintf("node_%s ansible_host=%s ansible_user=ubuntu\n", node.ID.String()[:8], node.IP)
			}
		}
	}

	return invStr, nil
}

// ConfigBundle wraps all generated strings into a single JSON response
type ConfigBundle struct {
	DockerCompose    string `json:"docker_compose"`
	DotEnv           string `json:"env"`
	AnsibleInventory string `json:"ansible_inventory"`
	Nginx            string `json:"nginx"`
}

// GenerateNginxConfig generates an Nginx reverse proxy configuration string
func (s *ConfigService) GenerateNginxConfig(buildID uuid.UUID) (string, error) {
	// Simple stub for now
	nginxStr := "# Generated by Orbit\n\n"
	nginxStr += "server {\n"
	nginxStr += "    listen 80;\n"
	nginxStr += "    server_name example.homelab.local;\n"
	nginxStr += "    location / {\n"
	nginxStr += "        proxy_pass http://127.0.0.1:8080;\n"
	nginxStr += "    }\n}\n"
	return nginxStr, nil
}

// GenerateAll generates all configurations for a build returning a ConfigBundle
func (s *ConfigService) GenerateAll(buildID uuid.UUID) (*ConfigBundle, error) {
	composeStr, err := s.GenerateDockerCompose(buildID)
	if err != nil {
		return nil, err
	}

	envStr, err := s.GenerateEnv(buildID)
	if err != nil {
		return nil, err
	}

	ansibleStr, err := s.GenerateAnsibleInventory(buildID)
	if err != nil {
		return nil, err
	}

	nginxStr, err := s.GenerateNginxConfig(buildID)
	if err != nil {
		return nil, err
	}

	return &ConfigBundle{
		DockerCompose:    composeStr,
		DotEnv:           envStr,
		AnsibleInventory: ansibleStr,
		Nginx:            nginxStr,
	}, nil
}
