import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Connection,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import type {
  Service,
  HardwareNode,
  HardwareType,
  HardwareComponent,
  HardwareNodeValidationIssue,
  K8sCluster,
  K8sMember,
  K8sRole,
  K8sWorkload,
} from '../../../types';
import { buildApi, type Build } from '../api/builds';
import { api } from '../../../services/api';

type Snapshot = { nodes: Node[]; edges: Edge[]; hardwareNodes: HardwareNode[] };

interface BuilderState {
  // Data Logic
  availableServices: Service[];
  fetchServices: () => Promise<void>;
  hardwareNodes: HardwareNode[];

  // Virtual edges derived from parent_id relationships
  getVirtualEdges: () => Edge[];

  // Visual Logic (React Flow Source of Truth)
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  updateEdge: (id: string, updates: Partial<Edge>) => void;
  onConnect: OnConnect;

  // Selection
  selectedNodeId: string | null;
  selectNode: (nodeId: string | null) => void;

  // Hardware Actions
  addHardware: (node: HardwareNode) => void;
  removeHardware: (nodeId: string) => void;
  updateHardware: (nodeId: string, updates: Partial<HardwareNode>) => void;
  duplicateHardware: (nodeId: string) => void;

  addInternalComponent: (nodeId: string, component: HardwareComponent) => void;
  removeInternalComponent: (nodeId: string, componentId: string) => void;
  updateInternalComponent: (
    nodeId: string,
    componentId: string,
    updates: Partial<HardwareComponent>,
  ) => void;

  // VM Node Management (VMs are standalone nodes with parent_id)
  addVMNode: (hostId: string, type: HardwareType, name: string) => void;

  // Reordering
  reorderInternalComponents: (nodeId: string, orderedIds: string[]) => void;

  // Actions
  autoAssignIP: (nodeId?: string) => string | null;
  reassignAllIPs: () => Promise<void>;

  // Purchase Tracking
  boughtItems: string[];
  markAsBought: (itemName: string) => void;
  unmarkAsBought: (itemName: string) => void;
  showBought: boolean;
  setShowBought: (v: boolean) => void;

  // Visual Preferences
  edgePreferences: {
    routingEngine: 'smart' | 'direct';
    connectionStyle: 'floating' | 'strict';
    lineStyle: 'bezier' | 'step' | 'straight';
  };
  setEdgePreferences: (prefs: Partial<BuilderState['edgePreferences']>) => void;

  // Tailscale VPN
  tailscaleEnabled: boolean;
  setTailscaleEnabled: (enabled: boolean) => void;
  tailscaleViewActive: boolean;
  setTailscaleViewActive: (active: boolean) => void;

  // Kubernetes Clusters
  k8sClusters: K8sCluster[];
  k8sMembers: K8sMember[];
  k8sWorkloads: K8sWorkload[];
  k8sOverlayActive: boolean;
  addK8sCluster: (cluster: K8sCluster) => void;
  removeK8sCluster: (id: string) => void;
  updateK8sCluster: (id: string, updates: Partial<K8sCluster>) => void;
  enrollInK8s: (nodeId: string, clusterId: string, role: K8sRole) => void;
  unenrollFromK8s: (nodeId: string) => void;
  setK8sOverlayActive: (active: boolean) => void;
  addK8sWorkload: (workload: K8sWorkload) => void;
  removeK8sWorkload: (id: string) => void;
  updateK8sWorkload: (id: string, updates: Partial<K8sWorkload>) => void;

  // Network Validation
  validationIssues: HardwareNodeValidationIssue[];
  validateNetwork: () => Promise<void>;

  clear: () => void;

  // ── API Persistence ────────────────────────────────────────────────
  currentBuildId: string | null;
  setCurrentBuildId: (id: string | null) => void;
  clearCurrentBuild: () => void;

  projectName: string;
  projectThumbnail: string;
  setProjectName: (name: string) => void;

  loadBuild: (id: string, name: string, data: Build) => void;
  getBuildData: () => any;

  // Computed getters
  totalCpu: () => number;
  totalRam: () => number;
  totalStorage: () => number;

  // Undo / Redo
  historyPast: Snapshot[];
  historyFuture: Snapshot[];
  undo: () => void;
  redo: () => void;
}

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set, get) => ({
      hardwareNodes: [],
      nodes: [],
      edges: [],
      selectedNodeId: null,
      boughtItems: [],
      showBought: false,
      historyPast: [],
      historyFuture: [],
      edgePreferences: {
        routingEngine: 'direct',
        connectionStyle: 'strict',
        lineStyle: 'step',
      },
      validationIssues: [],
      tailscaleEnabled: false,
      tailscaleViewActive: false,
      k8sClusters: [],
      k8sMembers: [],
      k8sWorkloads: [],
      k8sOverlayActive: false,
      availableServices: [],
      fetchServices: async () => {
        try {
          const res = await api.getServices();
          set({ availableServices: res.data || [] });
        } catch (e) {
          console.error('Failed to fetch services', e);
        }
      },

      getVirtualEdges: () => {
        const { hardwareNodes } = get();
        return hardwareNodes
          .filter(n => n.parent_id)
          .map(n => ({
            id: `virtual-${n.id}`,
            source: n.parent_id!,
            target: n.id,
            type: 'virtual',
            data: {},
            selectable: false,
            deletable: false,
          }));
      },

      setEdgePreferences: prefs =>
        set(state => ({
          edgePreferences: { ...state.edgePreferences, ...prefs },
        })),

      setTailscaleEnabled: enabled => {
        set({ tailscaleEnabled: enabled });
        setTimeout(() => get().reassignAllIPs(), 0);
      },
      setTailscaleViewActive: active => set({ tailscaleViewActive: active }),

      addK8sCluster: cluster => set(state => ({ k8sClusters: [...state.k8sClusters, cluster] })),

      removeK8sCluster: id =>
        set(state => ({
          k8sClusters: state.k8sClusters.filter(c => c.id !== id),
          k8sMembers: state.k8sMembers.filter(m => m.cluster_id !== id),
          k8sWorkloads: state.k8sWorkloads.filter(w => w.cluster_id !== id),
        })),

      updateK8sCluster: (id, updates) =>
        set(state => ({
          k8sClusters: state.k8sClusters.map(c => (c.id === id ? { ...c, ...updates } : c)),
        })),

      enrollInK8s: (nodeId, clusterId, role) =>
        set(state => {
          const filtered = state.k8sMembers.filter(m => m.node_id !== nodeId);
          return {
            k8sMembers: [...filtered, { node_id: nodeId, role, cluster_id: clusterId }],
          };
        }),

      unenrollFromK8s: (nodeId) =>
        set(state => ({
          k8sMembers: state.k8sMembers.filter(m => m.node_id !== nodeId),
        })),

      setK8sOverlayActive: active => set({ k8sOverlayActive: active }),

      addK8sWorkload: workload => set(state => ({ k8sWorkloads: [...state.k8sWorkloads, workload] })),

      removeK8sWorkload: id => set(state => ({ k8sWorkloads: state.k8sWorkloads.filter(w => w.id !== id) })),

      updateK8sWorkload: (id, updates) =>
        set(state => ({
          k8sWorkloads: state.k8sWorkloads.map(w => (w.id === id ? { ...w, ...updates } : w)),
        })),

      projectName: 'My Homelab',
      projectThumbnail: '',
      currentBuildId: null,

      onNodesChange: changes => {
        const dragEnds = changes.filter(c => c.type === 'position' && !(c as any).dragging);
        const removals = changes.filter(c => c.type === 'remove');
        if (dragEnds.length > 0 || removals.length > 0) {
          const state = get();
          const snap: Snapshot = {
            nodes: state.nodes,
            edges: state.edges,
            hardwareNodes: state.hardwareNodes,
          };
          set({
            historyPast: [...state.historyPast, snap].slice(-50),
            historyFuture: [],
            nodes: applyNodeChanges(changes, state.nodes),
          });
        } else {
          set({ nodes: applyNodeChanges(changes, get().nodes) });
        }
      },
      onEdgesChange: changes => {
        const removals = changes.filter(c => c.type === 'remove');
        if (removals.length > 0) {
          const state = get();
          const snap: Snapshot = {
            nodes: state.nodes,
            edges: state.edges,
            hardwareNodes: state.hardwareNodes,
          };
          set({
            historyPast: [...state.historyPast, snap].slice(-50),
            historyFuture: [],
            edges: applyEdgeChanges(changes, state.edges),
          });
        } else {
          set({ edges: applyEdgeChanges(changes, get().edges) });
        }
      },
      updateEdge: (id, updates) => {
        set(state => ({
          edges: state.edges.map(e => (e.id === id ? { ...e, ...updates } : e)),
        }));
      },
      onConnect: (connection: Connection) => {
        const state = get();
        const snap: Snapshot = {
          nodes: state.nodes,
          edges: state.edges,
          hardwareNodes: state.hardwareNodes,
        };
        const newEdges = addEdge({ ...connection, type: 'custom' }, state.edges);
        set({
          historyPast: [...state.historyPast, snap].slice(-50),
          historyFuture: [],
          edges: newEdges,
        });

        setTimeout(() => get().reassignAllIPs(), 0);
      },

      selectNode: nodeId => set({ selectedNodeId: nodeId }),

      addHardware: hardwareNode => {
        set(state => {
          const snap: Snapshot = {
            nodes: state.nodes,
            edges: state.edges,
            hardwareNodes: state.hardwareNodes,
          };
          const reactFlowNode: Node = {
            id: hardwareNode.id,
            type: 'hardware',
            position: { x: hardwareNode.x, y: hardwareNode.y },
            data: { label: hardwareNode.name, ...hardwareNode },
          };

          return {
            historyPast: [...state.historyPast, snap].slice(-50),
            historyFuture: [],
            hardwareNodes: [...state.hardwareNodes, hardwareNode],
            nodes: [...state.nodes, reactFlowNode],
          };
        });
      },

      removeHardware: nodeId =>
        set(state => {
          const snap: Snapshot = {
            nodes: state.nodes,
            edges: state.edges,
            hardwareNodes: state.hardwareNodes,
          };
          // Also remove child nodes (VMs) whose parent_id matches
          const childIds = state.hardwareNodes
            .filter(n => n.parent_id === nodeId)
            .map(n => n.id);
          const removeIds = new Set([nodeId, ...childIds]);

          return {
            historyPast: [...state.historyPast, snap].slice(-50),
            historyFuture: [],
            hardwareNodes: state.hardwareNodes.filter(n => !removeIds.has(n.id)),
            nodes: state.nodes.filter(n => !removeIds.has(n.id)),
            edges: state.edges.filter(e => !removeIds.has(e.source) && !removeIds.has(e.target)),
            selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
            k8sMembers: state.k8sMembers.filter(m => !removeIds.has(m.node_id)),
          };
        }),

      updateHardware: (nodeId, updates) =>
        set(state => ({
          hardwareNodes: state.hardwareNodes.map(n => (n.id === nodeId ? { ...n, ...updates } : n)),
          nodes: state.nodes.map(n =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, ...updates, label: updates.name ?? n.data.label } }
              : n,
          ),
        })),

      duplicateHardware: nodeId => {
        const state = get();
        const orig = state.hardwareNodes.find(n => n.id === nodeId);
        if (!orig) return;
        const newId = uuidv4();
        const dup: HardwareNode = {
          ...orig,
          id: newId,
          name: `${orig.name} (copy)`,
          ip: '',
          tailscale_ip: '',
          site: '',
          x: orig.x + 40,
          y: orig.y + 40,
          parent_id: orig.parent_id,
        };

        const rfNode: Node = {
          id: newId,
          type: 'hardware',
          position: { x: dup.x, y: dup.y },
          data: { label: dup.name, ...dup },
        };
        const snap: Snapshot = {
          nodes: state.nodes,
          edges: state.edges,
          hardwareNodes: state.hardwareNodes,
        };
        set({
          historyPast: [...state.historyPast, snap].slice(-50),
          historyFuture: [],
          hardwareNodes: [...state.hardwareNodes, dup],
          nodes: [...state.nodes, rfNode],
          selectedNodeId: newId,
        });
      },

      addInternalComponent: (nodeId, component) => {
        set(state => {
          const snap: Snapshot = {
            nodes: state.nodes,
            edges: state.edges,
            hardwareNodes: state.hardwareNodes,
          };
          const updated = state.hardwareNodes.map(n =>
            n.id === nodeId
              ? { ...n, internal_components: [...(n.internal_components || []), component] }
              : n,
          );
          return {
            historyPast: [...state.historyPast, snap].slice(-50),
            historyFuture: [],
            hardwareNodes: updated,
            nodes: state.nodes.map(n =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      internal_components: updated.find(h => h.id === nodeId)?.internal_components,
                    },
                  }
                : n,
            ),
          };
        });
      },

      removeInternalComponent: (nodeId, componentId) => {
        set(state => {
          const snap: Snapshot = {
            nodes: state.nodes,
            edges: state.edges,
            hardwareNodes: state.hardwareNodes,
          };
          const updated = state.hardwareNodes.map(n =>
            n.id === nodeId
              ? {
                  ...n,
                  internal_components: (n.internal_components || []).filter(
                    c => c.id !== componentId,
                  ),
                }
              : n,
          );
          return {
            historyPast: [...state.historyPast, snap].slice(-50),
            historyFuture: [],
            hardwareNodes: updated,
            nodes: state.nodes.map(n =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      internal_components: updated.find(h => h.id === nodeId)?.internal_components,
                    },
                  }
                : n,
            ),
          };
        });
      },

      updateInternalComponent: (nodeId, componentId, updates) => {
        set(state => {
          const updated = state.hardwareNodes.map(n =>
            n.id === nodeId
              ? {
                  ...n,
                  internal_components: (n.internal_components || []).map(c =>
                    c.id === componentId ? { ...c, ...updates } : c,
                  ),
                }
              : n,
          );
          return {
            hardwareNodes: updated,
            nodes: state.nodes.map(n =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      internal_components: updated.find(h => h.id === nodeId)?.internal_components,
                    },
                  }
                : n,
            ),
          };
        });
      },

      // ── VM Node Management ──────────────────────────────────────────────
      addVMNode: (hostId, type, name) => {
        const state = get();
        const host = state.hardwareNodes.find(n => n.id === hostId);
        if (!host) return;

        const vmId = uuidv4();
        const vmNode: HardwareNode = {
          id: vmId,
          type,
          name,
          x: host.x + 60,
          y: host.y + 200,
          parent_id: hostId,
          ip: '',
          details: {},
        };

        const rfNode: Node = {
          id: vmId,
          type: 'hardware',
          position: { x: vmNode.x, y: vmNode.y },
          data: { label: name, ...vmNode },
        };

        const snap: Snapshot = {
          nodes: state.nodes,
          edges: state.edges,
          hardwareNodes: state.hardwareNodes,
        };

        set({
          historyPast: [...state.historyPast, snap].slice(-50),
          historyFuture: [],
          hardwareNodes: [...state.hardwareNodes, vmNode],
          nodes: [...state.nodes, rfNode],
          selectedNodeId: vmId,
        });

        setTimeout(() => get().reassignAllIPs(), 0);
      },

      reorderInternalComponents: (nodeId, orderedIds) => {
        set(state => {
          const updated = state.hardwareNodes.map(n => {
            if (n.id !== nodeId) return n;
            const comps = n.internal_components || [];
            const byId = new Map(comps.map(c => [c.id, c]));
            const reordered = orderedIds.map(id => byId.get(id)).filter(Boolean) as HardwareComponent[];
            return { ...n, internal_components: reordered };
          });
          return {
            hardwareNodes: updated,
            nodes: state.nodes.map(n =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      internal_components: updated.find(h => h.id === nodeId)?.internal_components,
                    },
                  }
                : n,
            ),
          };
        });
      },

      autoAssignIP: _nodeId => {
        get().reassignAllIPs();
        return null;
      },

      undo: () => {
        const state = get();
        if (state.historyPast.length === 0) return;
        const past = [...state.historyPast];
        const snap = past.pop()!;
        const current: Snapshot = {
          nodes: state.nodes,
          edges: state.edges,
          hardwareNodes: state.hardwareNodes,
        };
        set({
          historyPast: past,
          historyFuture: [current, ...state.historyFuture].slice(0, 50),
          nodes: snap.nodes,
          edges: snap.edges,
          hardwareNodes: snap.hardwareNodes,
        });
      },

      redo: () => {
        const state = get();
        if (state.historyFuture.length === 0) return;
        const future = [...state.historyFuture];
        const snap = future.shift()!;
        const current: Snapshot = {
          nodes: state.nodes,
          edges: state.edges,
          hardwareNodes: state.hardwareNodes,
        };
        set({
          historyPast: [...state.historyPast, current].slice(-50),
          historyFuture: future,
          nodes: snap.nodes,
          edges: snap.edges,
          hardwareNodes: snap.hardwareNodes,
        });
      },

      reassignAllIPs: async () => {
        const { currentBuildId, projectName, getBuildData } = get();
        if (!currentBuildId) {
          console.error('No build ID, cannot calculate network');
          return;
        }

        try {
          const data = getBuildData();
          await buildApi.update(currentBuildId, {
            name: projectName || 'Untitled Project',
            thumbnail: '',
            ...data,
          });

          await buildApi.calculateNetwork(currentBuildId);

          const build = await buildApi.get(currentBuildId);

          // Build a lookup: "id" → { nodeIp, tailscaleIp }
          const ipById = new Map<string, { nodeIp: string; tailscaleIp: string }>();
          ((build as any).nodes ?? []).forEach((n: any) => {
            ipById.set(n.id, {
              nodeIp: n.ip,
              tailscaleIp: n.tailscale_ip || '',
            });
          });

          const hardwareNodesWithIPs = get().hardwareNodes.map(hn => {
            const entry = ipById.get(hn.id);
            if (!entry) return hn;
            return {
              ...hn,
              ip: entry.nodeIp,
              tailscale_ip: entry.tailscaleIp,
            };
          });

          const reactFlowNodesWithIPs = get().nodes.map(rfn => {
            const entry = ipById.get(rfn.id);
            if (!entry) return rfn;
            return {
              ...rfn,
              data: {
                ...rfn.data,
                ip: entry.nodeIp,
                tailscale_ip: entry.tailscaleIp,
              },
            };
          });

          set({
            hardwareNodes: hardwareNodesWithIPs as HardwareNode[],
            nodes: reactFlowNodesWithIPs as Node[],
          });

          await get().validateNetwork();
        } catch (e) {
          console.error('Failed to reassign IPs', e);
        }
      },

      validateNetwork: async () => {
        const { currentBuildId } = get();
        if (!currentBuildId) return;

        try {
          const response = await buildApi.validateNetwork(currentBuildId);
          const data = response.data || response;

          const issues: HardwareNodeValidationIssue[] = [];

          if (data.errors && Array.isArray(data.errors)) {
            data.errors.forEach((e: any) => issues.push({ ...e, type: 'error' }));
          }
          if (data.warnings && Array.isArray(data.warnings)) {
            data.warnings.forEach((w: any) => issues.push({ ...w, type: 'warning' }));
          }

          set({ validationIssues: issues });
        } catch (e) {
          console.error('Failed to validate network', e);
          set({ validationIssues: [] });
        }
      },

      // ── Purchase Tracking ──────────────────────────────────────────────
      markAsBought: itemName =>
        set(state => ({ boughtItems: [...new Set([...state.boughtItems, itemName])] })),

      unmarkAsBought: itemName =>
        set(state => ({ boughtItems: state.boughtItems.filter(n => n !== itemName) })),

      setShowBought: v => set({ showBought: v }),

      clear: () => set({ hardwareNodes: [], nodes: [], edges: [], boughtItems: [] }),

      // ── API Persistence ────────────────────────────────────────────────
      setCurrentBuildId: id => set({ currentBuildId: id }),
      clearCurrentBuild: () =>
        set({
          currentBuildId: null,
          projectName: 'Untitled Project',
          nodes: [],
          edges: [],
          hardwareNodes: [],
        }),
      setProjectName: name => set({ projectName: name }),

      loadBuild: (id, name, build: Build) => {
        const settings = build.settings || {};

        const hardwareNodes: HardwareNode[] = (build.nodes || []).map((n: any) => ({
          id: n.id,
          type: n.type as HardwareType,
          name: n.name,
          ip: n.ip,
          tailscale_ip: n.tailscale_ip || '',
          site: n.site || '',
          x: n.x || 0,
          y: n.y || 0,
          internal_components: n.internal_components || [],
          details: typeof n.details === 'string' ? JSON.parse(n.details) : n.details || {},
          parent_id: n.parent_id || undefined,
        }));

        const hwMap = new Map<string, HardwareNode>(hardwareNodes.map((n: any) => [n.id, n]));

        const rfNodes = (build.nodes || []).map((n: any) => ({
          id: n.id,
          type: 'hardware',
          position: { x: n.x, y: n.y },
          data: { ...(hwMap.get(n.id) || {}), label: n.name },
        }));

        const rfEdges = (build.edges || []).map((e: any) => ({
          id: String(e.id || `${e.source_node_id}-${e.target_node_id}`),
          source: String(e.source_node_id),
          sourceHandle: e.source_handle || undefined,
          target: String(e.target_node_id),
          targetHandle: e.target_handle || undefined,
          type: e.type && e.type !== 'ethernet' ? e.type : 'custom',
          data: {
            speed: e.speed || '1 GbE',
            subnet: e.subnet || '',
          },
        }));

        set({
          currentBuildId: id,
          projectName: name,
          hardwareNodes,
          nodes: rfNodes,
          edges: rfEdges,
          boughtItems: settings.boughtItems || [],
          showBought: settings.showBought || false,
          tailscaleEnabled: settings.tailscale_enabled || false,
          k8sClusters: settings.k8s_clusters || [],
          k8sMembers: settings.k8s_members || [],
          k8sWorkloads: settings.k8s_workloads || [],
        });
      },

      getBuildData: () => {
        const state = get();
        const hwMap = new Map<string, HardwareNode>(state.hardwareNodes.map(n => [n.id, n]));

        const nodesPayload = state.nodes.map(rfn => {
          const hw = hwMap.get(rfn.id) || ({} as any);
          return {
            id: rfn.id,
            type: rfn.data?.type || hw.type,
            name: rfn.data?.name || hw.name,
            x: rfn.position.x,
            y: rfn.position.y,
            ip: rfn.data?.ip || hw.ip || '',
            tailscale_ip: rfn.data?.tailscale_ip || hw.tailscale_ip || '',
            site: rfn.data?.site || hw.site || '',
            details: rfn.data?.details || hw.details || {},
            internal_components: rfn.data?.internal_components || hw.internal_components || [],
            parent_id: hw.parent_id || undefined,
          };
        });

        // Also include hardwareNodes that aren't in the nodes array (shouldn't happen normally)
        const nodeIds = new Set(state.nodes.map(n => n.id));
        for (const hw of state.hardwareNodes) {
          if (!nodeIds.has(hw.id)) {
            nodesPayload.push({
              id: hw.id,
              type: hw.type,
              name: hw.name,
              x: hw.x,
              y: hw.y,
              ip: hw.ip || '',
              tailscale_ip: hw.tailscale_ip || '',
              site: hw.site || '',
              details: hw.details || {},
              internal_components: hw.internal_components || [],
              parent_id: hw.parent_id || undefined,
            });
          }
        }

        const edgesPayload = state.edges.map(e => ({
          source: e.source,
          source_handle: e.sourceHandle || '',
          target: e.target,
          target_handle: e.targetHandle || '',
          speed: (e.data?.speed as string) || '1 GbE',
          subnet: (e.data?.subnet as string) || '',
        }));

        return {
          nodes: nodesPayload,
          edges: edgesPayload,
          services: [],
          settings: {
            boughtItems: state.boughtItems,
            showBought: state.showBought,
            tailscale_enabled: state.tailscaleEnabled,
            k8s_clusters: state.k8sClusters,
            k8s_members: state.k8sMembers,
            k8s_workloads: state.k8sWorkloads,
          },
        };
      },

      totalCpu: () => {
        const { hardwareNodes } = get();
        return hardwareNodes
          .filter(n => n.parent_id)
          .reduce((acc, n) => acc + (Number(n.details?.cpu) || 0), 0);
      },
      totalRam: () => {
        const { hardwareNodes } = get();
        return hardwareNodes
          .filter(n => n.parent_id)
          .reduce((acc, n) => {
            const ram = Number(n.details?.ram) || 0;
            return acc + (ram < 1000 ? ram * 1024 : ram);
          }, 0);
      },
      totalStorage: () => 0,
    }),
    {
      name: 'homelab-builder-storage',
      partialize: state => ({
        hardwareNodes: state.hardwareNodes,
        nodes: state.nodes,
        edges: state.edges,
        boughtItems: state.boughtItems,
        showBought: state.showBought,
        projectName: state.projectName,
        tailscaleEnabled: state.tailscaleEnabled,
        k8sClusters: state.k8sClusters,
        k8sMembers: state.k8sMembers,
        k8sWorkloads: state.k8sWorkloads,
      }),
    },
  ),
);
