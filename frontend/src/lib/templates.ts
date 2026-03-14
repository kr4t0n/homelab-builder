import { v4 as uuidv4 } from 'uuid';
import type { Node, Edge } from '@xyflow/react';
import type { HardwareNode } from '../types';

/**
 * Helper to generate a baseline template payload for the Fast Start Wizard.
 * Builds out strictly typed DTO Arrays compatible with the models.Build schema.
 */
export function generateFastStartPayload(goal: string, scale: string) {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const hardwareNodes: HardwareNode[] = [];

    // Base IDs
    const routerId = uuidv4();
    const switchId = uuidv4();
    const serverId = uuidv4();

    // 1. Add Router
    hardwareNodes.push({
        id: routerId,
        name: 'Core Router',
        type: 'router',
        x: 100, y: 100,
        vms: [],
        internal_components: [],
        details: { model: 'pfSense Virtual Router' }
    });

    // 2. Add Switch
    hardwareNodes.push({
        id: switchId,
        name: 'Main Switch',
        type: 'switch',
        x: 100, y: 300,
        vms: [],
        internal_components: [],
        details: { ports: 24, speed: '1GbE' } as any
    });

    // 3. Define Server hardware based on SCALE
    let serverName = 'Compute Node';
    let serverModel = '';
    let serverSpecs: Record<string, any> = {};
    const serverVms: any[] = [];

    switch (scale) {
        case 'mini':
            serverName = 'Mini PC';
            serverModel = 'Intel NUC 13 Pro';
            serverSpecs = { form_factor: 'USFF', cpu: 12, ram: 32 };
            break;
        case 'desktop':
            serverName = 'Tower Server';
            serverModel = 'Custom ATX Build';
            serverSpecs = { form_factor: 'Mid Tower', cpu: 6, ram: 64 };
            break;
        case 'rack':
            serverName = 'Rack Server';
            serverModel = 'Dell PowerEdge R740';
            serverSpecs = { form_factor: '2U Rackmount', cpu: 16, ram: 128 };
            break;
    }

    // 4. Populate VMs/Containers based on GOAL
    let pName = 'Homelab Setup';
    switch (goal) {
        case 'media':
            pName = 'Media Server Lab';
            serverVms.push({ id: uuidv4(), name: 'plex', type: 'container', status: 'running', cpu_cores: 2, ram_mb: 4096 });
            serverVms.push({ id: uuidv4(), name: 'Storage Pool', type: 'vm', status: 'running', cpu_cores: 4, ram_mb: 8192 });
            break;
        case 'nas':
            pName = 'Network Attached Storage';
            serverVms.push({ id: uuidv4(), name: 'TrueNAS Scale', type: 'vm', status: 'running', cpu_cores: 4, ram_mb: 16384 });
            break;
        case 'virtualization':
            pName = 'Virtualization Cluster';
            serverVms.push({ id: uuidv4(), name: 'Proxmox VE Hub', type: 'vm', status: 'running', cpu_cores: 8, ram_mb: 32768 });
            break;
        case 'network':
            pName = 'Network Topography Lab';
            serverVms.push({ id: uuidv4(), name: 'Docker Host', type: 'vm', status: 'running', cpu_cores: 4, ram_mb: 8192 });
            break;
    }

    hardwareNodes.push({
        id: serverId,
        name: serverName,
        type: 'server',
        x: 400, y: 300,
        vms: serverVms,
        internal_components: [],
        details: { model: serverModel, ...serverSpecs }
    });

    // 5. Connect the Graph
    edges.push({ id: `e-${routerId}-${switchId}`, source: routerId, target: switchId, sourceHandle: 'eth1', targetHandle: 'eth0' });
    edges.push({ id: `e-${switchId}-${serverId}`, source: switchId, target: serverId, sourceHandle: 'eth1', targetHandle: 'eth0' });

    // 6. Map to React Flow native DOM nodes array
    hardwareNodes.forEach(hn => {
        nodes.push({
            id: hn.id,
            type: 'hardware',
            position: { x: hn.x, y: hn.y },
            data: hn as unknown as Record<string, unknown>
        });
    });

    return {
        name: pName,
        nodes: nodes.map(rfn => {
            const h = hardwareNodes.find(n => n.id === rfn.id);
            return {
                id: rfn.id,
                type: h?.type || 'server',
                name: h?.name || '',
                x: rfn.position.x,
                y: rfn.position.y,
                ip: '',
                details: (h?.details as any) || {},
                vms: h?.vms || [],
                internal_components: h?.internal_components || []
            }
        }),
        edges: edges.map(e => ({
            source: e.source,
            target: e.target
        }))
    };
}
