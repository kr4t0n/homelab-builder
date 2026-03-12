/**
 * Config Generator Library
 * Generates Docker Compose, Ansible, .env, and Nginx configs from builder state
 */

import type { Service, HardwareNode, K8sCluster, K8sWorkload } from '../../../types'
// ip-allocator removed. Backend handles IP assignment.


// ─── Service image map ────────────────────────────────────────────────────────
const SERVICE_IMAGES: Record<string, { image: string; ports: string[]; volumes: string[]; env: string[] }> = {
    'Plex': { image: 'plexinc/pms-docker:latest', ports: ['32400:32400'], volumes: ['plex_config:/config', 'plex_media:/media'], env: ['PLEX_CLAIM='] },
    'Jellyfin': { image: 'jellyfin/jellyfin:latest', ports: ['8096:8096'], volumes: ['jellyfin_config:/config', 'jellyfin_media:/media'], env: [] },
    'Sonarr': { image: 'linuxserver/sonarr:latest', ports: ['8989:8989'], volumes: ['sonarr_config:/config', 'media:/tv'], env: ['PUID=1000', 'PGID=1000'] },
    'Radarr': { image: 'linuxserver/radarr:latest', ports: ['7878:7878'], volumes: ['radarr_config:/config', 'media:/movies'], env: ['PUID=1000', 'PGID=1000'] },
    'Prowlarr': { image: 'linuxserver/prowlarr:latest', ports: ['9696:9696'], volumes: ['prowlarr_config:/config'], env: ['PUID=1000', 'PGID=1000'] },
    'qBittorrent': { image: 'linuxserver/qbittorrent:latest', ports: ['8080:8080', '6881:6881'], volumes: ['qbt_config:/config', 'downloads:/downloads'], env: ['PUID=1000', 'PGID=1000'] },
    'Portainer': { image: 'portainer/portainer-ce:latest', ports: ['9000:9000', '9443:9443'], volumes: ['/var/run/docker.sock:/var/run/docker.sock', 'portainer_data:/data'], env: [] },
    'Nginx Proxy Manager': { image: 'jc21/nginx-proxy-manager:latest', ports: ['80:80', '443:443', '81:81'], volumes: ['npm_data:/data', 'npm_letsencrypt:/etc/letsencrypt'], env: [] },
    'Traefik': { image: 'traefik:v3.0', ports: ['80:80', '443:443', '8080:8080'], volumes: ['/var/run/docker.sock:/var/run/docker.sock', 'traefik_certs:/certs'], env: [] },
    'Grafana': { image: 'grafana/grafana:latest', ports: ['3000:3000'], volumes: ['grafana_data:/var/lib/grafana'], env: ['GF_SECURITY_ADMIN_PASSWORD=changeme'] },
    'Prometheus': { image: 'prom/prometheus:latest', ports: ['9090:9090'], volumes: ['prometheus_data:/prometheus', './prometheus.yml:/etc/prometheus/prometheus.yml:ro'], env: [] },
    'Home Assistant': { image: 'ghcr.io/home-assistant/home-assistant:stable', ports: ['8123:8123'], volumes: ['ha_config:/config'], env: [] },
    'Nextcloud': { image: 'nextcloud:latest', ports: ['8080:80'], volumes: ['nextcloud_data:/var/www/html'], env: ['MYSQL_HOST=db', 'MYSQL_DATABASE=nextcloud', 'MYSQL_USER=nextcloud', 'MYSQL_PASSWORD=changeme'] },
    'Vaultwarden': { image: 'vaultwarden/server:latest', ports: ['8080:80'], volumes: ['vaultwarden_data:/data'], env: ['ADMIN_TOKEN=changeme'] },
    'Gitea': { image: 'gitea/gitea:latest', ports: ['3000:3000', '2222:22'], volumes: ['gitea_data:/data'], env: [] },
    'Pi-hole': { image: 'pihole/pihole:latest', ports: ['53:53/tcp', '53:53/udp', '80:80'], volumes: ['pihole_etc:/etc/pihole', 'pihole_dnsmasq:/etc/dnsmasq.d'], env: ['WEBPASSWORD=changeme'] },
    'AdGuard Home': { image: 'adguard/adguardhome:latest', ports: ['53:53/tcp', '53:53/udp', '3000:3000', '80:80'], volumes: ['adguard_work:/opt/adguardhome/work', 'adguard_conf:/opt/adguardhome/conf'], env: [] },
    'Uptime Kuma': { image: 'louislam/uptime-kuma:latest', ports: ['3001:3001'], volumes: ['uptime_kuma_data:/app/data'], env: [] },
    'Immich': { image: 'ghcr.io/immich-app/immich-server:release', ports: ['2283:3001'], volumes: ['immich_upload:/usr/src/app/upload'], env: ['DB_PASSWORD=changeme', 'REDIS_HOSTNAME=redis'] },
    'Paperless-ngx': { image: 'ghcr.io/paperless-ngx/paperless-ngx:latest', ports: ['8000:8000'], volumes: ['paperless_data:/usr/src/paperless/data', 'paperless_media:/usr/src/paperless/media'], env: ['PAPERLESS_SECRET_KEY=changeme'] },
}

function getServiceConfig(name: string) {
    // Try exact match, then partial match
    if (SERVICE_IMAGES[name]) return SERVICE_IMAGES[name]
    const key = Object.keys(SERVICE_IMAGES).find(k => name.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(name.toLowerCase()))
    if (key) return SERVICE_IMAGES[key]
    // Fallback generic
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    return {
        image: `${slug}:latest`,
        ports: ['8080:8080'],
        volumes: [`${slug}_data:/data`],
        env: [],
    }
}

function randomSecret(len = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─── Docker Compose Generator ─────────────────────────────────────────────────
export function generateDockerCompose(services: Service[], nodes: HardwareNode[]): string {
    if (services.length === 0 && nodes.length === 0) return '# No services or hardware nodes configured.'

    const lines: string[] = [
        '# Generated by HLBuilder',
        `# Generated: ${new Date().toISOString()}`,
        '',
        'services:',
    ]

    services.forEach(svc => {
        const cfg = getServiceConfig(svc.name)
        const slug = svc.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
        lines.push(`  ${slug}:`)
        lines.push(`    image: ${cfg.image}`)
        lines.push(`    container_name: ${slug}`)
        lines.push(`    restart: unless-stopped`)
        if (cfg.ports.length > 0) {
            lines.push(`    ports:`)
            cfg.ports.forEach(p => lines.push(`      - "${p}"`))
        }
        if (cfg.volumes.length > 0) {
            lines.push(`    volumes:`)
            cfg.volumes.forEach(v => lines.push(`      - ${v}`))
        }
        if (cfg.env.length > 0) {
            lines.push(`    environment:`)
            cfg.env.forEach(e => lines.push(`      - ${e}`))
        }
        lines.push(`    networks:`)
        lines.push(`      - homelab`)
        lines.push('')
    })

    // Named volumes
    const allVolumes = new Set<string>()
    services.forEach(svc => {
        const cfg = getServiceConfig(svc.name)
        cfg.volumes.forEach(v => {
            const name = v.split(':')[0]
            if (!name.startsWith('/') && !name.startsWith('.')) allVolumes.add(name)
        })
    })

    if (allVolumes.size > 0) {
        lines.push('volumes:')
        allVolumes.forEach(v => lines.push(`  ${v}:`))
        lines.push('')
    }

    lines.push('networks:')
    lines.push('  homelab:')
    lines.push('    driver: bridge')

    return lines.join('\n')
}

// ─── .env Generator ──────────────────────────────────────────────────────────
export function generateDotEnv(services: Service[]): string {
    const lines: string[] = [
        '# Generated by HLBuilder',
        `# Generated: ${new Date().toISOString()}`,
        '# IMPORTANT: Change all placeholder values before deploying!',
        '',
        '# ── General ──────────────────────────────────────────────────────────',
        `HOMELAB_DOMAIN=homelab.local`,
        `PUID=1000`,
        `PGID=1000`,
        `TZ=Europe/Warsaw`,
        '',
    ]

    const seen = new Set<string>()
    services.forEach(svc => {
        const cfg = getServiceConfig(svc.name)
        const relevant = cfg.env.filter(e => e.includes('PASSWORD') || e.includes('SECRET') || e.includes('TOKEN') || e.includes('KEY'))
        if (relevant.length === 0) return
        lines.push(`# ── ${svc.name} ──────────────────────────────────────────────────────────`)
        relevant.forEach(e => {
            const [key] = e.split('=')
            if (!seen.has(key)) {
                seen.add(key)
                const isSecret = key.includes('SECRET') || key.includes('TOKEN') || key.includes('KEY')
                lines.push(`${key}=${isSecret ? randomSecret() : 'changeme_' + key.toLowerCase()}`)
            }
        })
        lines.push('')
    })

    return lines.join('\n')
}

// ─── Ansible Inventory + Playbook Generator ───────────────────────────────────
export function generateAnsibleInventory(nodes: HardwareNode[], _ipOpts: IpAllocatorOptions = {}): string {
    if (nodes.length === 0) return '# No hardware nodes configured.'

    // Simplified inventory generation using existing IPs
    const lines: string[] = [
        '# Generated by HLBuilder',
        `# Generated: ${new Date().toISOString()}`,
        '# IP Addresses should be assigned by the backend.',
        '',
        '[homelab]',
    ]

    nodes.forEach(node => {
        const slug = node.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
        let line = `${slug} ansible_host=${node.ip} ansible_user=ubuntu # ${node.type}`
        lines.push(line)

        // Add VMs as children or separate hosts?
        // For now, let's list VMs as separate hosts in inventory if they have IPs
        node.vms?.forEach(vm => {
            const vmSlug = vm.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
            if (vm.ip) {
                lines.push(`${vmSlug} ansible_host=${vm.ip} ansible_user=ubuntu # VM on ${node.name}`)
            }
        })
    })

    return lines.join('\n')
}

// Placeholder for removed interface
export interface IpAllocatorOptions {
    baseIp?: string;
    cidr?: number;
    homeRouterMode?: boolean;
    homeReserve?: number;
}

export function generateIpPlan(nodes: HardwareNode[], _opts: IpAllocatorOptions): string {
    const lines: string[] = [
        '# IP Address Plan (Calculated by Backend)',
        `# Generated: ${new Date().toISOString()}`,
        '',
        'Name'.padEnd(30) + 'IP Address'.padEnd(20) + 'Type',
        '-'.repeat(70)
    ]

    const allItems: { name: string, ip: string, type: string }[] = []

    nodes.forEach(n => {
        if (n.ip) allItems.push({ name: n.name, ip: n.ip, type: n.type })
        n.vms?.forEach(vm => {
            if (vm.ip) allItems.push({ name: vm.name, ip: vm.ip, type: vm.type })
        })
    })

    // Sort by IP
    allItems.sort((a, b) => {
        const ipA = a.ip.split('.').map(Number);
        const ipB = b.ip.split('.').map(Number);
        for (let i = 0; i < 4; i++) {
            if (ipA[i] !== ipB[i]) return ipA[i] - ipB[i];
        }
        return 0;
    });

    allItems.forEach(item => {
        lines.push(`${item.name.padEnd(30)}${item.ip.padEnd(20)}${item.type}`)
    })

    return lines.join('\n')
}


export function generateAnsiblePlaybook(services: Service[], _nodes: HardwareNode[]): string {
    const lines: string[] = [
        '# Generated by HLBuilder',
        `# Generated: ${new Date().toISOString()}`,
        '',
        '---',
        '- name: Homelab Setup',
        '  hosts: homelab',
        '  become: true',
        '  vars:',
        '    docker_compose_dir: /opt/homelab',
        '',
        '  tasks:',
        '    - name: Install Docker',
        '      apt:',
        '        name:',
        '          - docker.io',
        '          - docker-compose-plugin',
        '        state: present',
        '        update_cache: yes',
        '',
        '    - name: Start Docker service',
        '      service:',
        '        name: docker',
        '        state: started',
        '        enabled: yes',
        '',
        '    - name: Create homelab directory',
        '      file:',
        '        path: "{{ docker_compose_dir }}"',
        '        state: directory',
        '        mode: \'0755\'',
        '',
        '    - name: Copy docker-compose.yml',
        '      copy:',
        '        src: docker-compose.yml',
        '        dest: "{{ docker_compose_dir }}/docker-compose.yml"',
        '',
        '    - name: Copy .env file',
        '      copy:',
        '        src: .env',
        '        dest: "{{ docker_compose_dir }}/.env"',
        '        mode: \'0600\'',
        '',
        '    - name: Start services',
        '      community.docker.docker_compose_v2:',
        '        project_src: "{{ docker_compose_dir }}"',
        '        state: present',
        '',
    ]

    if (services.length > 0) {
        lines.push('    # ── Service-specific tasks ──────────────────────────────────────────')
        services.forEach(svc => {
            lines.push(`    - name: Ensure ${svc.name} is running`)
            lines.push(`      community.docker.docker_container_info:`)
            lines.push(`        name: ${svc.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`)
            lines.push(`      register: ${svc.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_info`)
            lines.push('')
        })
    }

    return lines.join('\n')
}

// ─── Nginx Reverse Proxy Config ───────────────────────────────────────────────
export function generateNginxConfig(services: Service[], domain = 'homelab.local'): string {
    const lines: string[] = [
        '# Generated by HLBuilder',
        `# Generated: ${new Date().toISOString()}`,
        '',
    ]

    services.forEach(svc => {
        const cfg = getServiceConfig(svc.name)
        const firstPort = cfg.ports[0]?.split(':')[1] ?? '8080'
        const subdomain = svc.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
        lines.push(`# ── ${svc.name} ────────────────────────────────────────────────────────`)
        lines.push(`server {`)
        lines.push(`    listen 80;`)
        lines.push(`    server_name ${subdomain}.${domain};`)
        lines.push(``)
        lines.push(`    location / {`)
        lines.push(`        proxy_pass http://127.0.0.1:${firstPort};`)
        lines.push(`        proxy_set_header Host $host;`)
        lines.push(`        proxy_set_header X-Real-IP $remote_addr;`)
        lines.push(`        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`)
        lines.push(`        proxy_set_header X-Forwarded-Proto $scheme;`)
        lines.push(`    }`)
        lines.push(`}`)
        lines.push(``)
    })

    return lines.join('\n')
}

// ─── Kubernetes Manifests Generator ───────────────────────────────────────────
export function generateK8sManifests(clusters: K8sCluster[], workloads: K8sWorkload[]): string {
    if (workloads.length === 0) return '# No Kubernetes workloads configured.'

    const docs: string[] = [
        '# Generated by HLBuilder — Kubernetes Manifests',
        `# Generated: ${new Date().toISOString()}`,
    ]

    const nonDefaultNamespaces = [...new Set(workloads.filter(w => w.namespace !== 'default').map(w => w.namespace))]
    for (const ns of nonDefaultNamespaces) {
        docs.push('---')
        docs.push(`apiVersion: v1`)
        docs.push(`kind: Namespace`)
        docs.push(`metadata:`)
        docs.push(`  name: ${ns}`)
    }

    for (const wl of workloads) {
        const cluster = clusters.find(c => c.id === wl.cluster_id)
        const slug = wl.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const cfg = getServiceConfig(wl.name)

        docs.push('---')
        docs.push(`# Cluster: ${cluster?.name || 'unknown'}`)
        docs.push(`apiVersion: apps/v1`)
        docs.push(`kind: Deployment`)
        docs.push(`metadata:`)
        docs.push(`  name: ${slug}`)
        docs.push(`  namespace: ${wl.namespace}`)
        docs.push(`  labels:`)
        docs.push(`    app: ${slug}`)
        if (cluster) docs.push(`    hlbuilder.cluster: ${cluster.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`)
        docs.push(`spec:`)
        docs.push(`  replicas: ${wl.replicas}`)
        docs.push(`  selector:`)
        docs.push(`    matchLabels:`)
        docs.push(`      app: ${slug}`)
        docs.push(`  template:`)
        docs.push(`    metadata:`)
        docs.push(`      labels:`)
        docs.push(`        app: ${slug}`)
        docs.push(`    spec:`)
        docs.push(`      containers:`)
        docs.push(`        - name: ${slug}`)
        docs.push(`          image: ${cfg.image}`)

        if (wl.port) {
            docs.push(`          ports:`)
            docs.push(`            - containerPort: ${wl.port}`)
        }

        if (wl.cpu_request || wl.ram_request) {
            docs.push(`          resources:`)
            docs.push(`            requests:`)
            if (wl.cpu_request) docs.push(`              cpu: "${wl.cpu_request}m"`)
            if (wl.ram_request) docs.push(`              memory: "${wl.ram_request}Mi"`)
            docs.push(`            limits:`)
            if (wl.cpu_request) docs.push(`              cpu: "${wl.cpu_request * 2}m"`)
            if (wl.ram_request) docs.push(`              memory: "${wl.ram_request * 2}Mi"`)
        }

        if (cfg.volumes.length > 0) {
            docs.push(`          volumeMounts:`)
            cfg.volumes.forEach((v, i) => {
                const mountPath = v.split(':')[1] || '/data'
                docs.push(`            - name: vol-${i}`)
                docs.push(`              mountPath: ${mountPath}`)
            })
            docs.push(`      volumes:`)
            cfg.volumes.forEach((v, i) => {
                const name = v.split(':')[0]
                if (name.startsWith('/') || name.startsWith('.')) return
                docs.push(`        - name: vol-${i}`)
                docs.push(`          persistentVolumeClaim:`)
                docs.push(`            claimName: ${slug}-vol-${i}`)
            })
        }

        if (wl.port) {
            docs.push('---')
            docs.push(`apiVersion: v1`)
            docs.push(`kind: Service`)
            docs.push(`metadata:`)
            docs.push(`  name: ${slug}`)
            docs.push(`  namespace: ${wl.namespace}`)
            docs.push(`spec:`)
            docs.push(`  selector:`)
            docs.push(`    app: ${slug}`)
            docs.push(`  ports:`)
            docs.push(`    - port: ${wl.port}`)
            docs.push(`      targetPort: ${wl.port}`)
            docs.push(`  type: ClusterIP`)
        }

        if (wl.ingress && wl.port) {
            docs.push('---')
            docs.push(`apiVersion: networking.k8s.io/v1`)
            docs.push(`kind: Ingress`)
            docs.push(`metadata:`)
            docs.push(`  name: ${slug}`)
            docs.push(`  namespace: ${wl.namespace}`)
            docs.push(`  annotations:`)
            docs.push(`    nginx.ingress.kubernetes.io/rewrite-target: /`)
            docs.push(`spec:`)
            docs.push(`  rules:`)
            docs.push(`    - host: ${slug}.local`)
            docs.push(`      http:`)
            docs.push(`        paths:`)
            docs.push(`          - path: /`)
            docs.push(`            pathType: Prefix`)
            docs.push(`            backend:`)
            docs.push(`              service:`)
            docs.push(`                name: ${slug}`)
            docs.push(`                port:`)
            docs.push(`                  number: ${wl.port}`)
        }
    }

    return docs.join('\n')
}

// ─── Traefik Labels Generator ─────────────────────────────────────────────────
export function generateTraefikLabels(services: Service[], domain = 'homelab.local'): string {
    const lines: string[] = [
        '# Generated by HLBuilder — Traefik labels',
        `# Generated: ${new Date().toISOString()}`,
        '# Add these labels to each service in your docker-compose.yml',
        '',
    ]

    services.forEach(svc => {
        const slug = svc.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const cfg = getServiceConfig(svc.name)
        const port = cfg.ports[0]?.split(':')[1] ?? '8080'
        lines.push(`# ── ${svc.name}`)
        lines.push(`labels:`)
        lines.push(`  - "traefik.enable=true"`)
        lines.push(`  - "traefik.http.routers.${slug}.rule=Host(\`${slug}.${domain}\`)"`)
        lines.push(`  - "traefik.http.routers.${slug}.entrypoints=websecure"`)
        lines.push(`  - "traefik.http.routers.${slug}.tls.certresolver=letsencrypt"`)
        lines.push(`  - "traefik.http.services.${slug}.loadbalancer.server.port=${port}"`)
        lines.push('')
    })

    return lines.join('\n')
}
