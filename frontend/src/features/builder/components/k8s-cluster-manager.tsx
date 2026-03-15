import { useState, useEffect } from 'react';
import { useBuilderStore } from '../store/builder-store';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/ui/dialog';
import { Plus, Trash2, Pencil, Check, X, Network, Package, Search, Crown, Cog, Globe } from 'lucide-react';
import type { K8sCluster, K8sDistro, K8sCNI } from '../../../types';
import { cn } from '../../../lib/utils';

const CLUSTER_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16',
];

const DISTRO_LABELS: Record<K8sDistro, string> = {
  kubernetes: 'Kubernetes',
};

const CNI_LABELS: Record<K8sCNI, string> = {
  flannel: 'Flannel',
  calico: 'Calico',
  cilium: 'Cilium',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function K8sClusterManager({ open, onOpenChange }: Props) {
  const {
    k8sClusters, k8sMembers, k8sWorkloads, availableServices,
    addK8sCluster, removeK8sCluster, updateK8sCluster,
    addK8sWorkload, removeK8sWorkload,
    hardwareNodes,
  } = useBuilderStore();

  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingWorkload, setAddingWorkload] = useState(false);
  const [workloadSearch, setWorkloadSearch] = useState('');
  const [workloadForm, setWorkloadForm] = useState({
    name: '',
    service_id: '' as string | undefined,
    namespace: 'default',
    replicas: 1,
    port: 8080,
    cpu_request: 0,
    ram_request: 0,
    ingress: false,
  });
  const [form, setForm] = useState({
    name: '',
    distro: 'kubernetes' as K8sDistro,
    pod_cidr: '10.42.0.0/16',
    service_cidr: '10.43.0.0/16',
    cni: 'flannel' as K8sCNI,
    api_server_port: 6443,
  });

  const selectedCluster = k8sClusters.find(c => c.id === selectedClusterId) || null;

  useEffect(() => {
    if (k8sClusters.length > 0 && !selectedClusterId) {
      setSelectedClusterId(k8sClusters[0].id);
    }
    if (selectedClusterId && !k8sClusters.find(c => c.id === selectedClusterId)) {
      setSelectedClusterId(k8sClusters[0]?.id || null);
    }
  }, [k8sClusters, selectedClusterId]);

  const resetForm = () => {
    setForm({ name: '', distro: 'kubernetes', pod_cidr: '10.42.0.0/16', service_cidr: '10.43.0.0/16', cni: 'flannel', api_server_port: 6443 });
  };

  const resetWorkloadForm = () => {
    setWorkloadForm({ name: '', service_id: undefined, namespace: 'default', replicas: 1, port: 8080, cpu_request: 0, ram_request: 0, ingress: false });
    setWorkloadSearch('');
  };

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const color = CLUSTER_COLORS[k8sClusters.length % CLUSTER_COLORS.length];
    const id = `k8s-${Date.now()}`;
    addK8sCluster({ id, name: form.name, distro: form.distro, pod_cidr: form.pod_cidr, service_cidr: form.service_cidr, cni: form.cni, api_server_port: form.api_server_port, color });
    setSelectedClusterId(id);
    resetForm();
    setIsAdding(false);
  };

  const startEdit = (cluster: K8sCluster) => {
    setEditingId(cluster.id);
    setForm({ name: cluster.name, distro: cluster.distro, pod_cidr: cluster.pod_cidr, service_cidr: cluster.service_cidr, cni: cluster.cni, api_server_port: cluster.api_server_port });
  };

  const saveEdit = () => {
    if (!editingId || !form.name.trim()) return;
    updateK8sCluster(editingId, { ...form });
    setEditingId(null);
    resetForm();
  };

  const handleAddWorkload = () => {
    if (!workloadForm.name.trim() || !selectedClusterId) return;
    addK8sWorkload({
      id: `k8s-wl-${Date.now()}`,
      cluster_id: selectedClusterId,
      service_id: workloadForm.service_id || undefined,
      name: workloadForm.name,
      namespace: workloadForm.namespace || 'default',
      replicas: workloadForm.replicas,
      cpu_request: workloadForm.cpu_request || undefined,
      ram_request: workloadForm.ram_request || undefined,
      port: workloadForm.port || undefined,
      ingress: workloadForm.ingress,
    });
    resetWorkloadForm();
    setAddingWorkload(false);
  };

  const selectServiceForWorkload = (svc: { id: string; name: string; requirements?: any }) => {
    const reqs = svc.requirements;
    setWorkloadForm(p => ({
      ...p,
      name: svc.name,
      service_id: svc.id,
      cpu_request: reqs?.recommended_cpu_cores ? reqs.recommended_cpu_cores * 1000 : p.cpu_request,
      ram_request: reqs?.recommended_ram_mb || p.ram_request,
    }));
    setWorkloadSearch('');
  };

  const filteredServices = availableServices.filter(s =>
    s.name.toLowerCase().includes(workloadSearch.toLowerCase()),
  );

  const getClusterMembers = (clusterId: string) =>
    k8sMembers.filter(m => m.cluster_id === clusterId);

  const getClusterWorkloads = (clusterId: string) =>
    k8sWorkloads.filter(w => w.cluster_id === clusterId);

  const getMemberLabel = (m: { node_id: string; role: string }) => {
    const node = hardwareNodes.find(n => n.id === m.node_id);
    return node?.name || 'Unknown';
  };

  const renderClusterForm = (onSave: () => void, onCancel: () => void, saveLabel: string) => (
    <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1">Cluster Name</Label>
          <Input className="h-8 text-sm" placeholder="e.g. prod-cluster" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs mb-1">Distro</Label>
          <select className="w-full h-8 text-sm rounded-md border bg-background px-2" value={form.distro} onChange={e => setForm(p => ({ ...p, distro: e.target.value as K8sDistro }))}>
            {Object.entries(DISTRO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1">Pod CIDR</Label>
          <Input className="h-8 text-sm font-mono" value={form.pod_cidr} onChange={e => setForm(p => ({ ...p, pod_cidr: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs mb-1">Service CIDR</Label>
          <Input className="h-8 text-sm font-mono" value={form.service_cidr} onChange={e => setForm(p => ({ ...p, service_cidr: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1">CNI</Label>
          <select className="w-full h-8 text-sm rounded-md border bg-background px-2" value={form.cni} onChange={e => setForm(p => ({ ...p, cni: e.target.value as K8sCNI }))}>
            {Object.entries(CNI_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs mb-1">API Port</Label>
          <Input className="h-8 text-sm font-mono" type="number" value={form.api_server_port} onChange={e => setForm(p => ({ ...p, api_server_port: Number(e.target.value) }))} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-8 text-sm flex-1" onClick={onSave}>
          {saveLabel === 'Save' ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          {saveLabel}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-violet-400" />
            <DialogTitle>Kubernetes Clusters</DialogTitle>
          </div>
          <DialogDescription>
            Manage clusters, nodes, and workloads deployed to your Kubernetes infrastructure.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden" style={{ height: 'calc(80vh - 100px)' }}>
          {/* Left: Cluster list */}
          <div className="w-56 border-r bg-muted/20 flex flex-col shrink-0">
            <div className="p-2 border-b">
              <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => { resetForm(); setIsAdding(true); setEditingId(null); }}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> New Cluster
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {k8sClusters.map(cluster => {
                const members = getClusterMembers(cluster.id);
                const workloads = getClusterWorkloads(cluster.id);
                const isSelected = selectedClusterId === cluster.id;
                return (
                  <button
                    key={cluster.id}
                    onClick={() => { setSelectedClusterId(cluster.id); setIsAdding(false); setEditingId(null); }}
                    className={cn(
                      'w-full text-left rounded-md px-2.5 py-2 transition-colors group',
                      isSelected ? 'bg-accent' : 'hover:bg-muted/60',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cluster.color }} />
                      <span className="text-xs font-semibold truncate flex-1">{cluster.name}</span>
                    </div>
                    <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground pl-[18px]">
                      <span>{members.length} node{members.length !== 1 ? 's' : ''}</span>
                      <span>{workloads.length} svc</span>
                    </div>
                  </button>
                );
              })}
              {k8sClusters.length === 0 && !isAdding && (
                <p className="text-xs text-muted-foreground text-center py-6 px-2">No clusters yet.</p>
              )}
            </div>
          </div>

          {/* Right: Detail panel */}
          <div className="flex-1 overflow-y-auto p-5">
            {isAdding && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Create New Cluster</h3>
                {renderClusterForm(handleAdd, () => { setIsAdding(false); resetForm(); }, 'Create')}
              </div>
            )}

            {!isAdding && !selectedCluster && k8sClusters.length > 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">Select a cluster to view details.</p>
            )}

            {!isAdding && !selectedCluster && k8sClusters.length === 0 && (
              <div className="text-center py-12">
                <Network className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Create your first Kubernetes cluster to get started.</p>
                <Button size="sm" variant="outline" onClick={() => { resetForm(); setIsAdding(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New Cluster
                </Button>
              </div>
            )}

            {!isAdding && selectedCluster && (
              <div className="space-y-5">
                {/* Cluster header */}
                {editingId === selectedCluster.id ? (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Edit Cluster</h3>
                    {renderClusterForm(saveEdit, () => { setEditingId(null); resetForm(); }, 'Save')}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: selectedCluster.color }} />
                        <h3 className="text-base font-bold">{selectedCluster.name}</h3>
                        <Badge variant="outline" className="text-[10px] h-5">{DISTRO_LABELS[selectedCluster.distro]}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => startEdit(selectedCluster)}>
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => removeK8sCluster(selectedCluster.id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mt-3">
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <span className="text-[10px] text-muted-foreground block">CNI</span>
                        <span className="text-xs font-medium">{CNI_LABELS[selectedCluster.cni]}</span>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <span className="text-[10px] text-muted-foreground block">API Port</span>
                        <span className="text-xs font-mono font-medium">{selectedCluster.api_server_port}</span>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <span className="text-[10px] text-muted-foreground block">Pod CIDR</span>
                        <span className="text-xs font-mono font-medium">{selectedCluster.pod_cidr}</span>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <span className="text-[10px] text-muted-foreground block">Service CIDR</span>
                        <span className="text-xs font-mono font-medium">{selectedCluster.service_cidr}</span>
                      </div>
                    </div>
                  </div>
                )}

                {editingId !== selectedCluster.id && (
                  <>
                    {/* Nodes section */}
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Enrolled Nodes</h4>
                      {(() => {
                        const members = getClusterMembers(selectedCluster.id);
                        if (members.length === 0) {
                          return (
                            <p className="text-xs text-muted-foreground py-3 px-3 border border-dashed rounded-lg text-center">
                              No nodes enrolled. Use the node properties panel to assign nodes to this cluster.
                            </p>
                          );
                        }
                        return (
                          <div className="grid grid-cols-2 gap-2">
                            {members.map((m, i) => (
                              <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2 bg-background/60">
                                {m.role === 'master' ? (
                                  <Crown className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                                ) : (
                                  <Cog className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                                )}
                                <span className="text-xs font-medium truncate flex-1">{getMemberLabel(m)}</span>
                                <Badge variant="outline" className={cn(
                                  'text-[9px] h-4 px-1.5',
                                  m.role === 'master' ? 'text-violet-400 border-violet-500/30' : 'text-sky-400 border-sky-500/30',
                                )}>
                                  {m.role}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Workloads section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workloads</h4>
                        {!addingWorkload && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAddingWorkload(true); resetWorkloadForm(); }}>
                            <Plus className="h-3 w-3 mr-1" /> Add Workload
                          </Button>
                        )}
                      </div>

                      {addingWorkload && (
                        <div className="rounded-lg border bg-muted/30 p-4 space-y-3 mb-3">
                          <div className="relative">
                            <Label className="text-xs mb-1">Service</Label>
                            <div className="relative">
                              <Input
                                className="h-8 text-sm pr-8"
                                placeholder="Search catalog or type a name..."
                                value={workloadSearch || workloadForm.name}
                                onChange={e => {
                                  setWorkloadSearch(e.target.value);
                                  setWorkloadForm(p => ({ ...p, name: e.target.value, service_id: undefined }));
                                }}
                              />
                              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            {workloadSearch && filteredServices.length > 0 && (
                              <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-lg max-h-40 overflow-y-auto">
                                {filteredServices.slice(0, 10).map(svc => (
                                  <button
                                    key={svc.id}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 flex items-center gap-2"
                                    onClick={() => selectServiceForWorkload(svc)}
                                  >
                                    <Package className="h-3 w-3 text-emerald-400 shrink-0" />
                                    <span className="truncate flex-1">{svc.name}</span>
                                    <span className="text-muted-foreground text-[10px]">{svc.category}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs mb-1">Namespace</Label>
                              <Input className="h-8 text-sm font-mono" value={workloadForm.namespace} onChange={e => setWorkloadForm(p => ({ ...p, namespace: e.target.value }))} />
                            </div>
                            <div>
                              <Label className="text-xs mb-1">Replicas</Label>
                              <Input className="h-8 text-sm" type="number" min={1} value={workloadForm.replicas} onChange={e => setWorkloadForm(p => ({ ...p, replicas: Number(e.target.value) }))} />
                            </div>
                            <div>
                              <Label className="text-xs mb-1">Port</Label>
                              <Input className="h-8 text-sm font-mono" type="number" value={workloadForm.port} onChange={e => setWorkloadForm(p => ({ ...p, port: Number(e.target.value) }))} />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-8 text-sm" onClick={handleAddWorkload} disabled={!workloadForm.name.trim()}>
                              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Workload
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-sm" onClick={() => { setAddingWorkload(false); resetWorkloadForm(); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {(() => {
                        const workloads = getClusterWorkloads(selectedCluster.id);
                        if (workloads.length === 0 && !addingWorkload) {
                          return (
                            <p className="text-xs text-muted-foreground py-3 px-3 border border-dashed rounded-lg text-center">
                              No workloads deployed. Add services to run on this cluster.
                            </p>
                          );
                        }
                        const namespaces = [...new Set(workloads.map(w => w.namespace))];
                        return (
                          <div className="space-y-3">
                            {namespaces.map(ns => {
                              const nsWorkloads = workloads.filter(w => w.namespace === ns);
                              return (
                                <div key={ns}>
                                  {namespaces.length > 1 && (
                                    <span className="text-[10px] text-muted-foreground font-mono block mb-1">namespace/{ns}</span>
                                  )}
                                  <div className="space-y-1.5">
                                    {nsWorkloads.map(wl => (
                                      <div key={wl.id} className="flex items-center gap-3 rounded-md border px-3 py-2 bg-background/60 group">
                                        <Package className="h-4 w-4 text-emerald-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <span className="text-sm font-medium block truncate">{wl.name}</span>
                                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                            <span className="font-mono">{wl.namespace}</span>
                                            <span>x{wl.replicas}</span>
                                            {wl.port && <span className="font-mono">:{wl.port}</span>}
                                            {wl.cpu_request ? <span>{wl.cpu_request}m CPU</span> : null}
                                            {wl.ram_request ? <span>{wl.ram_request}MB</span> : null}
                                          </div>
                                        </div>
                                        {wl.ingress && (
                                          <Badge variant="outline" className="text-[10px] h-5 text-emerald-400 border-emerald-500/30">
                                            <Globe className="h-2.5 w-2.5 mr-1" /> Ingress
                                          </Badge>
                                        )}
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                                          onClick={() => removeK8sWorkload(wl.id)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
