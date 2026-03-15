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

    const routerId = uuidv4();
    const switchId = uuidv4();
    const serverId = uuidv4();

    hardwareNodes.push({
        id: routerId,
        name: 'Core Router',
        type: 'router',
        x: 100, y: 100,
        internal_components: [],
        details: { model: 'pfSense Virtual Router' }
    });

    hardwareNodes.push({
        id: switchId,
        name: 'Main Switch',
        type: 'switch',
        x: 100, y: 300,
        internal_components: [],
        details: { ports: 24, speed: '1GbE' } as any
    });

    let serverName = 'Compute Node';
    let serverModel = '';
    let serverSpecs: Record<string, any> = {};

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

    let pName = 'Homelab Setup';
    switch (goal) {
        case 'media':
            pName = 'Media Server Lab';
            hardwareNodes.push({
                id: uuidv4(), name: 'plex', type: 'server',
                x: 600, y: 200, parent_id: serverId,
                details: { cpu: 2, ram: 4096 },
            });
            hardwareNodes.push({
                id: uuidv4(), name: 'Storage Pool', type: 'nas',
                x: 600, y: 350, parent_id: serverId,
                details: { cpu: 4, ram: 8192 },
            });
            break;
        case 'nas':
            pName = 'Network Attached Storage';
            hardwareNodes.push({
                id: uuidv4(), name: 'TrueNAS Scale', type: 'nas',
                x: 600, y: 200, parent_id: serverId,
                details: { cpu: 4, ram: 16384 },
            });
            break;
        case 'virtualization':
            pName = 'Virtualization Cluster';
            hardwareNodes.push({
                id: uuidv4(), name: 'Proxmox VE Hub', type: 'server',
                x: 600, y: 200, parent_id: serverId,
                details: { cpu: 8, ram: 32768 },
            });
            break;
        case 'network':
            pName = 'Network Topography Lab';
            hardwareNodes.push({
                id: uuidv4(), name: 'Docker Host', type: 'server',
                x: 600, y: 200, parent_id: serverId,
                details: { cpu: 4, ram: 8192 },
            });
            break;
    }

    hardwareNodes.push({
        id: serverId,
        name: serverName,
        type: 'server',
        x: 400, y: 300,
        internal_components: [],
        details: { model: serverModel, ...serverSpecs }
    });

    edges.push({ id: `e-${routerId}-${switchId}`, source: routerId, target: switchId, sourceHandle: 'eth1', targetHandle: 'eth0' });
    edges.push({ id: `e-${switchId}-${serverId}`, source: switchId, target: serverId, sourceHandle: 'eth1', targetHandle: 'eth0' });

    hardwareNodes.forEach(hn => {
        if (!hn.parent_id) {
            nodes.push({
                id: hn.id,
                type: 'hardware',
                position: { x: hn.x, y: hn.y },
                data: hn as unknown as Record<string, unknown>
            });
        }
    });

    return {
        name: pName,
        nodes: hardwareNodes.map(h => ({
            id: h.id,
            type: h.type,
            name: h.name,
            x: h.x,
            y: h.y,
            ip: '',
            details: (h.details as any) || {},
            parent_id: h.parent_id,
            internal_components: h.internal_components || [],
        })),
        edges: edges.map(e => ({
            source: e.source,
            target: e.target
        }))
    };
}
