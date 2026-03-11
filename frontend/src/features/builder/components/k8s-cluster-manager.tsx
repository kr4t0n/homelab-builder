import { useState } from 'react';
import { useBuilderStore } from '../store/builder-store';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Plus, Trash2, Pencil, Check, X, Network } from 'lucide-react';
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
  const { k8sClusters, k8sMembers, addK8sCluster, removeK8sCluster, updateK8sCluster, hardwareNodes } = useBuilderStore();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    distro: 'kubernetes' as K8sDistro,
    pod_cidr: '10.42.0.0/16',
    service_cidr: '10.43.0.0/16',
    cni: 'flannel' as K8sCNI,
    api_server_port: 6443,
  });

  const resetForm = () => {
    setForm({
      name: '',
      distro: 'kubernetes',
      pod_cidr: '10.42.0.0/16',
      service_cidr: '10.43.0.0/16',
      cni: 'flannel',
      api_server_port: 6443,
    });
  };

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const color = CLUSTER_COLORS[k8sClusters.length % CLUSTER_COLORS.length];
    addK8sCluster({
      id: `k8s-${Date.now()}`,
      name: form.name,
      distro: form.distro,
      pod_cidr: form.pod_cidr,
      service_cidr: form.service_cidr,
      cni: form.cni,
      api_server_port: form.api_server_port,
      color,
    });
    resetForm();
    setIsAdding(false);
  };

  const startEdit = (cluster: K8sCluster) => {
    setEditingId(cluster.id);
    setForm({
      name: cluster.name,
      distro: cluster.distro,
      pod_cidr: cluster.pod_cidr,
      service_cidr: cluster.service_cidr,
      cni: cluster.cni,
      api_server_port: cluster.api_server_port,
    });
  };

  const saveEdit = () => {
    if (!editingId || !form.name.trim()) return;
    updateK8sCluster(editingId, { ...form });
    setEditingId(null);
    resetForm();
  };

  const getMemberCount = (clusterId: string) =>
    k8sMembers.filter(m => m.cluster_id === clusterId).length;

  const getMemberNames = (clusterId: string) => {
    const members = k8sMembers.filter(m => m.cluster_id === clusterId);
    return members.map(m => {
      const node = hardwareNodes.find(n => n.id === m.node_id);
      if (m.vm_id) {
        const vm = node?.vms?.find(v => v.id === m.vm_id);
        return vm?.name || 'Unknown VM';
      }
      return node?.name || 'Unknown';
    });
  };

  if (!open) return null;

  const renderForm = (onSave: () => void, onCancel: () => void, saveLabel: string) => (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Cluster Name</Label>
          <Input
            className="h-7 text-xs"
            placeholder="e.g. prod-cluster"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-[10px]">Distro</Label>
          <select
            className="w-full h-7 text-xs rounded-md border bg-background px-2"
            value={form.distro}
            onChange={e => setForm(p => ({ ...p, distro: e.target.value as K8sDistro }))}
          >
            {Object.entries(DISTRO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Pod CIDR</Label>
          <Input
            className="h-7 text-xs font-mono"
            value={form.pod_cidr}
            onChange={e => setForm(p => ({ ...p, pod_cidr: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-[10px]">Service CIDR</Label>
          <Input
            className="h-7 text-xs font-mono"
            value={form.service_cidr}
            onChange={e => setForm(p => ({ ...p, service_cidr: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">CNI</Label>
          <select
            className="w-full h-7 text-xs rounded-md border bg-background px-2"
            value={form.cni}
            onChange={e => setForm(p => ({ ...p, cni: e.target.value as K8sCNI }))}
          >
            {Object.entries(CNI_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[10px]">API Port</Label>
          <Input
            className="h-7 text-xs font-mono"
            type="number"
            value={form.api_server_port}
            onChange={e => setForm(p => ({ ...p, api_server_port: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs flex-1" onClick={onSave}>
          {saveLabel === 'Save' ? <Check className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
          {saveLabel}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="absolute top-14 left-2 z-50 w-80 rounded-lg border bg-card shadow-xl animate-in slide-in-from-top-2">
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/50">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Network className="h-4 w-4 text-violet-400" />
          Kubernetes Clusters
        </div>
        <div className="flex items-center gap-1">
          {!isAdding && !editingId && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => { resetForm(); setIsAdding(true); }}
            >
              <Plus className="h-3 w-3 mr-1" /> New
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {isAdding && renderForm(handleAdd, () => { setIsAdding(false); resetForm(); }, 'Create')}

        {k8sClusters.length === 0 && !isAdding && (
          <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
            No clusters yet. Click New to create one.
          </p>
        )}

        {k8sClusters.map(cluster => {
          if (editingId === cluster.id) {
            return <div key={cluster.id}>{renderForm(saveEdit, () => { setEditingId(null); resetForm(); }, 'Save')}</div>;
          }

          const memberCount = getMemberCount(cluster.id);
          const memberNames = getMemberNames(cluster.id);

          return (
            <div key={cluster.id} className="rounded-lg border bg-background/60 p-2.5 group">
              <div className="flex items-start gap-2">
                <div
                  className="mt-1 h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: cluster.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate">{cluster.name}</span>
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0">
                      {DISTRO_LABELS[cluster.distro]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground mt-0.5">
                    <span>{CNI_LABELS[cluster.cni]}</span>
                    <span>:{cluster.api_server_port}</span>
                    <span className={cn(memberCount > 0 ? 'text-primary' : '')}>
                      {memberCount} node{memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                    <span title="Pod CIDR">P: {cluster.pod_cidr}</span>
                    <span title="Service CIDR">S: {cluster.service_cidr}</span>
                  </div>
                  {memberNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {memberNames.map((name, i) => {
                        const member = k8sMembers.filter(m => m.cluster_id === cluster.id)[i];
                        return (
                          <span
                            key={i}
                            className={cn(
                              'inline-flex items-center rounded px-1 py-px text-[9px] font-semibold border',
                              member?.role === 'master'
                                ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                                : 'bg-sky-500/15 text-sky-400 border-sky-500/30',
                            )}
                          >
                            {member?.role === 'master' ? 'M' : 'W'}: {name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={() => startEdit(cluster)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeK8sCluster(cluster.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
