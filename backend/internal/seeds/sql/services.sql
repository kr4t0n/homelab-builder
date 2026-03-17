-- Seed data: Common homelab services with realistic hardware requirements
-- Categories: media, home_automation, networking, storage, monitoring, gaming, management

-- Plex Media Server
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000001', 'plex', 'Stream your personal media collection to any device. Supports transcoding for remote access.', 'media', 'plex', 'https://www.plex.tv', 'https://support.plex.tv', '', '["transcoding", "media", "streaming"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000001', 1024, 4096, 1, 4, 10, 50);

-- Jellyfin
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000002', 'jellyfin', 'Free open-source media server. Browse and stream your media without any subscription.', 'media', 'jellyfin', 'https://jellyfin.org', 'https://jellyfin.org/docs/', 'https://github.com/jellyfin/jellyfin', '["open-source", "media", "streaming"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000002', 512, 2048, 1, 2, 10, 30);

-- Home Assistant
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000003', 'home-assistant', 'Open-source home automation platform. Control all your smart home devices from one place.', 'home_automation', 'home-assistant', 'https://www.home-assistant.io', 'https://www.home-assistant.io/docs/', 'https://github.com/home-assistant/core', '["automation", "smarthome"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000003', 512, 2048, 1, 2, 10, 32);

-- Pi-hole
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000004', 'pi-hole', 'Network-wide ad blocking. Blocks ads and trackers at the DNS level for all devices.', 'networking', 'pi-hole', 'https://pi-hole.net', 'https://docs.pi-hole.net', 'https://github.com/pi-hole', '["dns", "ad-blocker", "privacy"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000004', 128, 256, 0.5, 1, 2, 5);

-- Traefik
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000005', 'traefik', 'Modern reverse proxy and load balancer. Auto-discovers services and handles SSL.', 'networking', 'traefik', 'https://traefik.io', 'https://doc.traefik.io/traefik/', 'https://github.com/traefik/traefik', '["proxy", "ssl", "load-balancer"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000005', 128, 256, 0.5, 1, 1, 2);

-- Nextcloud
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000006', 'nextcloud', 'Self-hosted cloud storage and collaboration platform. Your own Google Drive alternative.', 'storage', 'nextcloud', 'https://nextcloud.com', 'https://docs.nextcloud.com', 'https://github.com/nextcloud/server', '["cloud", "files", "sync"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000006', 1024, 4096, 1, 2, 20, 100);

-- Portainer
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000007', 'portainer', 'Web-based Docker management UI. Easily manage containers, images, and networks.', 'management', 'portainer', 'https://www.portainer.io', 'https://docs.portainer.io', 'https://github.com/portainer/portainer', '["docker", "gui", "management"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000007', 256, 512, 0.5, 1, 2, 5);

-- AdGuard Home
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000008', 'adguard-home', 'Network-wide ad and tracker blocking with DNS-over-HTTPS support.', 'networking', 'adguard', 'https://adguard.com/adguard-home.html', 'https://github.com/AdguardTeam/AdGuardHome/wiki', 'https://github.com/AdguardTeam/AdGuardHome', '["dns", "ad-blocker", "privacy"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000008', 128, 256, 0.5, 1, 2, 5);

-- Grafana
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000009', 'grafana', 'Beautiful dashboards for monitoring. Visualize metrics from Prometheus, InfluxDB, and more.', 'monitoring', 'grafana', 'https://grafana.com', 'https://grafana.com/docs/', 'https://github.com/grafana/grafana', '["monitoring", "dashboards", "metrics"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000009', 256, 512, 0.5, 1, 2, 10);

-- Uptime Kuma
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000010', 'uptime-kuma', 'Self-hosted monitoring tool. Track uptime of your services with beautiful status pages.', 'monitoring', 'uptime-kuma', 'https://github.com/louislam/uptime-kuma', 'https://github.com/louislam/uptime-kuma/wiki', 'https://github.com/louislam/uptime-kuma', '["uptime", "monitoring", "status"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000010', 128, 256, 0.5, 1, 1, 3);

-- Minecraft Server
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000011', 'minecraft-server', 'Host your own Minecraft server. Support for Java and Bedrock editions.', 'gaming', 'minecraft', 'https://www.minecraft.net', 'https://minecraft.fandom.com/wiki/Server', '', '["game", "multiplayer", "java"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000011', 2048, 4096, 2, 4, 5, 20);

-- Nginx Proxy Manager
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000012', 'nginx-proxy-manager', 'Easy-to-use reverse proxy with a web UI. Manage SSL certificates and proxy hosts visually.', 'networking', 'nginx', 'https://nginxproxymanager.com', 'https://nginxproxymanager.com/guide/', 'https://github.com/NginxProxyManager/nginx-proxy-manager', '["proxy", "nginx", "ssl"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000012', 128, 256, 0.5, 1, 1, 2);

-- Prometheus
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000013', 'prometheus', 'Time-series monitoring and alerting. Collect metrics from your infrastructure and services.', 'monitoring', 'prometheus', 'https://prometheus.io', 'https://prometheus.io/docs/introduction/overview/', 'https://github.com/prometheus/prometheus', '["metrics", "monitoring", "time-series"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000013', 512, 2048, 1, 2, 10, 50);

-- Vaultwarden (Bitwarden)
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000014', 'vaultwarden', 'Self-hosted password manager compatible with Bitwarden clients. Lightweight and secure.', 'management', 'bitwarden', 'https://github.com/dani-garcia/vaultwarden', 'https://github.com/dani-garcia/vaultwarden/wiki', 'https://github.com/dani-garcia/vaultwarden', '["passwords", "security", "bitwarden"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000014', 64, 256, 0.5, 1, 1, 3);

-- Immich (Photo management)
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000015', 'immich', 'Self-hosted photo and video backup. Google Photos alternative with AI-powered features.', 'media', 'immich', 'https://immich.app', 'https://immich.app/docs/overview/quick-start', 'https://github.com/immich-app/immich', '["photos", "backup", "ai"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000015', 2048, 6144, 2, 4, 20, 100);

-- code-server
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000016', 'code-server', 'VS Code running in the browser. Access your dev environment from any device.', 'management', 'vscode', 'https://coder.com', 'https://coder.com/docs/code-server', 'https://github.com/coder/code-server', '["ide", "development", "vscode"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000016', 512, 2048, 1, 2, 5, 20);

-- bytebase
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000017', 'bytebase', 'Database DevOps and CI/CD platform. Schema migration, review, and governance for teams.', 'management', 'bytebase', 'https://www.bytebase.com', 'https://www.bytebase.com/docs', 'https://github.com/bytebase/bytebase', '["database", "devops", "migration"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000017', 512, 2048, 1, 2, 5, 20);

-- mariadb
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000018', 'mariadb', 'Community-developed MySQL fork. Drop-in replacement with improved performance and features.', 'storage', 'mariadb', 'https://mariadb.org', 'https://mariadb.com/kb/en/', 'https://github.com/MariaDB/server', '["database", "mysql", "sql"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000018', 256, 1024, 1, 2, 5, 50);

-- postgres
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000019', 'postgres', 'Powerful open-source relational database. Industry standard for reliability and feature set.', 'storage', 'postgresql', 'https://www.postgresql.org', 'https://www.postgresql.org/docs/', 'https://github.com/postgres/postgres', '["database", "sql", "relational"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000019', 256, 1024, 1, 2, 5, 50);

-- calibre-web
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000020', 'calibre-web', 'Web-based ebook library manager. Browse, read, and download your book collection.', 'media', 'calibre', 'https://github.com/janeczku/calibre-web', 'https://github.com/janeczku/calibre-web/wiki', 'https://github.com/janeczku/calibre-web', '["ebooks", "library", "reading"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000020', 256, 512, 0.5, 1, 5, 20);

-- kikoeru
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000021', 'kikoeru', 'Self-hosted audio media server. Organize and stream your audiobook and audio collection.', 'media', 'kikoeru', 'https://github.com/nortonandrews/kikoern', '', 'https://github.com/nortonandrews/kikoeru', '["audio", "audiobooks", "streaming"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000021', 256, 512, 0.5, 1, 5, 50);

-- photoprism
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000022', 'photoprism', 'AI-powered photo management app. Browse, organize, and share your photo collection.', 'media', 'photoprism', 'https://www.photoprism.app', 'https://docs.photoprism.app', 'https://github.com/photoprism/photoprism', '["photos", "ai", "gallery"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000022', 2048, 4096, 2, 4, 20, 100);

-- tautulli
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000023', 'tautulli', 'Monitoring and analytics for Plex Media Server. Track activity, history, and statistics.', 'monitoring', 'tautulli', 'https://tautulli.com', 'https://github.com/Tautulli/Tautulli/wiki', 'https://github.com/Tautulli/Tautulli', '["plex", "monitoring", "analytics"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000023', 128, 512, 0.5, 1, 2, 5);

-- kite
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000024', 'kite', 'Lightweight self-hosted file sharing and cloud storage. Simple and fast web interface.', 'storage', 'kite', 'https://github.com/nickvdyck/kite', '', 'https://github.com/nickvdyck/kite', '["files", "sharing", "cloud"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000024', 128, 256, 0.5, 1, 2, 20);

-- vault
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000025', 'vault', 'HashiCorp secrets management. Securely store and access tokens, passwords, and certificates.', 'management', 'vault', 'https://www.vaultproject.io', 'https://developer.hashicorp.com/vault/docs', 'https://github.com/hashicorp/vault', '["secrets", "security", "encryption"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000025', 256, 512, 0.5, 1, 2, 10);

-- velero
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000026', 'velero', 'Kubernetes backup and disaster recovery. Backup cluster resources and persistent volumes.', 'management', 'velero', 'https://velero.io', 'https://velero.io/docs', 'https://github.com/vmware-tanzu/velero', '["kubernetes", "backup", "disaster-recovery"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000026', 256, 512, 0.5, 1, 2, 10);

-- oauth2-proxy
INSERT INTO services (id, name, description, category, icon, official_website, docs_url, github_url, tags, docker_support)
VALUES ('a1000000-0000-0000-0000-000000000027', 'oauth2-proxy', 'Reverse proxy for authentication. Add OAuth2 login to any application without code changes.', 'networking', 'oauth2-proxy', 'https://oauth2-proxy.github.io/oauth2-proxy/', 'https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview', 'https://github.com/oauth2-proxy/oauth2-proxy', '["auth", "proxy", "oauth"]', true);
INSERT INTO service_requirements (service_id, min_ram_mb, recommended_ram_mb, min_cpu_cores, recommended_cpu_cores, min_storage_gb, recommended_storage_gb)
VALUES ('a1000000-0000-0000-0000-000000000027', 64, 128, 0.5, 1, 1, 2);
