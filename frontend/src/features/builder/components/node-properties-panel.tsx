import { useEffect, useState } from 'react';
import { useBuilderStore } from '../store/builder-store';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  X,
  Trash2,
  AlertCircle,
  Wand2,
  AlertTriangle,
  Lock,
  Unlock,
  ChevronDown,
  Shield,
  Network,
  Plus,
  Server,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import type { HardwareType } from '../../../types';
import { InternalComponentManager } from './internal-component-manager';
import { canNodeHostVMs, nodeHasCPU, nodeHasDynamicPorts, nodeHasRAM, nodeHasStorage, isNetworkNode, isComputeNode } from '../../../lib/hardware-config';
import { getNodePortCount, parsePortCount } from '../lib/port-count';

import type { K8sRole } from '../../../types';

const IP_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

function K8sEnrollmentSection({ nodeId }: { nodeId: string }) {
  const { k8sClusters, k8sMembers, enrollInK8s, unenrollFromK8s } = useBuilderStore();

  const membership = k8sMembers.find(m => m.node_id === nodeId);
  const cluster = membership ? k8sClusters.find(c => c.id === membership.cluster_id) : null;

  if (k8sClusters.length === 0) return null;

  return (
    <div className="space-y-2 pt-4 border-t">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Network className="h-3 w-3 text-violet-400" />
        Kubernetes
      </h4>

      <div className="flex gap-2">
        <select
          className="flex-1 h-7 text-xs rounded-md border bg-background px-2"
          value={membership?.cluster_id || ''}
          onChange={e => {
            const val = e.target.value;
            if (!val) {
              unenrollFromK8s(nodeId);
            } else {
              enrollInK8s(nodeId, val, membership?.role || 'worker');
            }
          }}
        >
          <option value="">Not enrolled</option>
          {k8sClusters.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {membership && (
          <select
            className="w-24 h-7 text-xs rounded-md border bg-background px-2"
            value={membership.role}
            onChange={e => enrollInK8s(nodeId, membership.cluster_id, e.target.value as K8sRole)}
          >
            <option value="master">Master</option>
            <option value="worker">Worker</option>
          </select>
        )}
      </div>

      {cluster && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cluster.color }} />
          <span>{cluster.name}</span>
          <span className={cn(
            'px-1 py-px rounded text-[9px] font-semibold',
            membership?.role === 'master'
              ? 'bg-violet-500/15 text-violet-400'
              : 'bg-sky-500/15 text-sky-400',
          )}>
            {membership?.role === 'master' ? 'Master' : 'Worker'}
          </span>
        </div>
      )}
    </div>
  );
}

export function NodePropertiesPanel() {
  const {
    selectedNodeId,
    hardwareNodes,
    selectNode,
    updateHardware,
    removeHardware,
    autoAssignIP,
    addVMNode,
  } = useBuilderStore();

  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [tailscaleIp, setTailscaleIp] = useState('');
  const [site, setSite] = useState('');
  const [mask, setMask] = useState('');
  const [gateway, setGateway] = useState('');
  const [dhcpEnabled, setDhcpEnabled] = useState(false);
  const [dhcpLocked, setDhcpLocked] = useState(false);
  const [model, setModel] = useState('');
  const [cpu, setCpu] = useState('');
  const [ram, setRam] = useState('');
  const [storage, setStorage] = useState('');
  const [ports, setPorts] = useState('');

  const [ramUnit, setRamUnit] = useState<'GB' | 'TB'>('GB');
  const [storageUnit, setStorageUnit] = useState<'GB' | 'TB'>('GB');

  const [errors, setErrors] = useState<{ ip?: string; tailscaleIp?: string; mask?: string; gateway?: string }>({});
  const [netOpen, setNetOpen] = useState(false);

  const selectedNode = hardwareNodes.find(n => n.id === selectedNodeId);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (ip && !IP_REGEX.test(ip)) newErrors.ip = 'Invalid IPv4';
    if (tailscaleIp && !IP_REGEX.test(tailscaleIp)) newErrors.tailscaleIp = 'Invalid IPv4';
    if (mask && !IP_REGEX.test(mask)) newErrors.mask = 'Invalid mask';
    if (gateway && !IP_REGEX.test(gateway)) newErrors.gateway = 'Invalid gateway';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (selectedNode) {
      if (name !== selectedNode.name) setName(selectedNode.name);
      if (ip !== (selectedNode.ip || '')) setIp(selectedNode.ip || '');
      if (tailscaleIp !== (selectedNode.tailscale_ip || '')) setTailscaleIp(selectedNode.tailscale_ip || '');
      if (site !== (selectedNode.site || '')) setSite(selectedNode.site || '');
      if (mask !== (selectedNode.subnet_mask || '')) setMask(selectedNode.subnet_mask || '');
      if (gateway !== (selectedNode.gateway || '')) setGateway(selectedNode.gateway || '');
      if (dhcpEnabled !== (selectedNode.details?.dhcp_enabled ?? true))
        setDhcpEnabled(selectedNode.details?.dhcp_enabled ?? true);
      if (dhcpLocked !== (selectedNode.details?.dhcp_locked ?? false))
        setDhcpLocked(selectedNode.details?.dhcp_locked ?? false);

      if (model !== (selectedNode.details?.model || ''))
        setModel(selectedNode.details?.model || '');
      if (cpu !== (selectedNode.details?.cpu?.toString() || ''))
        setCpu(selectedNode.details?.cpu?.toString() || '');

      if (selectedNode.details?.ram) {
        const r = Number(selectedNode.details.ram);
        if (r >= 1000 && r % 1000 === 0) {
          setRam(String(r / 1000));
          setRamUnit('TB');
        } else {
          setRam(String(r));
          setRamUnit('GB');
        }
      } else {
        setRam('');
        setRamUnit('GB');
      }

      if (selectedNode.details?.storage) {
        const s = Number(selectedNode.details.storage);
        if (s >= 1000 && s % 1000 === 0) {
          setStorage(String(s / 1000));
          setStorageUnit('TB');
        } else {
          setStorage(String(s));
          setStorageUnit('GB');
        }
      } else {
        setStorage('');
        setStorageUnit('GB');
      }

      const portValue = selectedNode.details?.ports;
      const normalizedPorts =
        portValue === undefined
          ? ''
          : String(parsePortCount(portValue) ?? getNodePortCount(selectedNode.type, portValue));
      if (ports !== normalizedPorts) setPorts(normalizedPorts);

      setErrors({});
    }
  }, [selectedNode]);

  useEffect(() => {
    if (!selectedNode) return;

    const timer = setTimeout(() => {
      if (validate()) {
        const parseNum = (val: string) => {
          if (!val || val.trim() === '') return undefined;
          const num = Number(val);
          return isNaN(num) ? undefined : num;
        };

        const rVal = parseNum(ram);
        const sVal = parseNum(storage);

        updateHardware(selectedNode.id, {
          name,
          ip,
          tailscale_ip: tailscaleIp,
          site,
          subnet_mask: mask,
          gateway,
          details: {
            ...selectedNode.details,
            model,
            dhcp_enabled: selectedNode.type === 'router' ? dhcpEnabled : undefined,
            dhcp_locked: dhcpLocked,
            cpu: parseNum(cpu),
            ram: rVal ? rVal * (ramUnit === 'TB' ? 1000 : 1) : undefined,
            storage: sVal ? sVal * (storageUnit === 'TB' ? 1000 : 1) : undefined,
            ports: parseNum(ports),
          },
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    name,
    ip,
    tailscaleIp,
    site,
    mask,
    gateway,
    dhcpEnabled,
    dhcpLocked,
    model,
    cpu,
    ram,
    ramUnit,
    storage,
    storageUnit,
    ports,
  ]);

  if (!selectedNode) return null;

  const isVM = !!selectedNode.parent_id;
  const hostNode = isVM ? hardwareNodes.find(n => n.id === selectedNode.parent_id) : null;

  const handleDelete = () => {
    removeHardware(selectedNode.id);
    selectNode(null);
  };

  const handleAutoIP = () => {
    const assigned = autoAssignIP(selectedNode.id);
    if (assigned) setIp(assigned);
    else toast.error('No router with a configured IP found. Add a Router and set its IP first.');
  };

  const handleIpChange = (val: string) => {
    setIp(val);
    if (val.trim() === '') {
      setDhcpLocked(false);
    } else {
      setDhcpLocked(true);
    }
  };

  const handleAddVM = () => {
    addVMNode(selectedNode.id, 'server', 'New VM');
  };

  const tailscaleEnabled = useBuilderStore(s => s.tailscaleEnabled);
  const isRouter = selectedNode.type === 'router';
  const supportsVMs = canNodeHostVMs(selectedNode.type) && !isVM;
  const isNetworked = isNetworkNode(selectedNode.type);

  // Resource limit calculations for host nodes
  const allHardwareNodes = useBuilderStore(s => s.hardwareNodes);
  const childVMs = allHardwareNodes.filter(n => n.parent_id === selectedNode.id);
  const usedCpu = childVMs.reduce((acc, vm) => acc + (Number(vm.details?.cpu) || 0), 0);
  const usedRam = childVMs.reduce((acc, vm) => {
    const r = Number(vm.details?.ram) || 0;
    return acc + (r < 1000 ? r * 1024 : r);
  }, 0);

  const totalCpu = Number(selectedNode.details?.cpu) || 0;
  const totalRamGB = Number(selectedNode.details?.ram) || 0;
  const totalRamMB = totalRamGB < 1000 ? totalRamGB * 1024 : totalRamGB;

  const cpuWarning = !isVM && totalCpu > 0 && usedCpu > totalCpu;
  const ramWarning = !isVM && totalRamMB > 0 && usedRam > totalRamMB;
  const hasWarning = cpuWarning || ramWarning;

  return (
    <Card className="absolute top-8 right-8 w-80 shadow-none z-10 border-l animate-in slide-in-from-right-10 bg-card max-h-[calc(100vh-6rem)] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-3 bg-muted/50 border-b shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Node Properties
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
            {selectedNode.type}
          </span>
          {isVM && (
            <span className="text-[10px] bg-violet-500/15 text-violet-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
              VM
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
            title="Delete Node"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => selectNode(null)}
            className="h-6 w-6 rounded-full hover:bg-muted"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4 overflow-y-auto flex-1">
        {/* Host display for VM nodes */}
        {isVM && hostNode && (
          <div className="flex items-center gap-2 p-2 bg-violet-500/5 border border-violet-500/20 rounded-md">
            <Server className="h-4 w-4 text-violet-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-violet-400 uppercase tracking-wider font-medium">Host Machine</p>
              <p
                className="text-xs font-semibold truncate cursor-pointer hover:underline"
                onClick={() => selectNode(hostNode.id)}
                title={`Click to select ${hostNode.name}`}
              >
                {hostNode.name}
              </p>
            </div>
          </div>
        )}

        {/* VM Type selector — shown before name for VMs */}
        {isVM && (
          <div className="space-y-2">
            <Label htmlFor="vm-type">VM Type</Label>
            <select
              id="vm-type"
              className="w-full h-9 text-sm rounded-md border bg-background px-3"
              value={selectedNode.type}
              onChange={e => updateHardware(selectedNode.id, { type: e.target.value as HardwareType })}
            >
              <option value="server">Server</option>
              <option value="nas">NAS</option>
              <option value="pc">PC</option>
              <option value="minipc">Mini PC</option>
              <option value="sbc">SBC</option>
            </select>
          </div>
        )}

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Main Router"
          />
        </div>

        {/* Advanced Network Config Collapsible */}
        {isNetworked && (
          <div className="border rounded-md px-3 pt-3 bg-muted/20">
            <button
              type="button"
              className="w-full flex items-center justify-between font-medium text-xs cursor-pointer pb-3"
              onClick={() => setNetOpen(o => !o)}
            >
              <span>Advanced Network Settings</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 text-muted-foreground ${netOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className="grid transition-all duration-300 ease-in-out"
              style={{ gridTemplateRows: netOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="pb-3 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="ip">IP Address</Label>
                      <div className="flex items-center gap-1">
                        {errors.ip && (
                          <span className="text-[10px] text-destructive flex items-center">
                            <AlertCircle className="h-3 w-3 mr-0.5" />
                            {errors.ip}
                          </span>
                        )}
                        {!isRouter && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] text-primary"
                            onClick={handleAutoIP}
                          >
                            <Wand2 className="h-3 w-3 mr-0.5" /> Auto
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="ip"
                        value={ip}
                        onChange={e => handleIpChange(e.target.value)}
                        placeholder={
                          isRouter ? '192.168.1.1' : dhcpLocked ? 'Static IP' : 'auto from router'
                        }
                        className={
                          errors.ip ? 'border-destructive focus-visible:ring-destructive' : ''
                        }
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className={`h-9 w-9 shrink-0 transition-colors ${dhcpLocked ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 hover:text-primary' : 'text-muted-foreground'}`}
                        onClick={() => setDhcpLocked(!dhcpLocked)}
                        title={dhcpLocked ? 'IP is Locked (Static)' : 'IP is Auto-Assigned (DHCP)'}
                      >
                        {dhcpLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {dhcpLocked
                        ? 'This IP is locked and will not be overwritten by Auto Assign.'
                        : 'This IP can be overwritten by Auto Assign if DHCP is enabled.'}
                    </p>
                  </div>

                  {tailscaleEnabled && isNetworked && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="tailscale-ip" className="flex items-center gap-1.5 text-blue-400">
                          <Shield className="h-3 w-3" />
                          Tailscale IP
                        </Label>
                        {errors.tailscaleIp && (
                          <span className="text-[10px] text-destructive flex items-center">
                            <AlertCircle className="h-3 w-3 mr-0.5" />
                            {errors.tailscaleIp}
                          </span>
                        )}
                      </div>
                      <Input
                        id="tailscale-ip"
                        value={tailscaleIp}
                        onChange={e => setTailscaleIp(e.target.value)}
                        placeholder="100.100.1.1"
                        className={cn(
                          'font-mono text-blue-300 bg-blue-950/20 border-blue-500/30 focus-visible:ring-blue-500/50',
                          errors.tailscaleIp ? 'border-destructive focus-visible:ring-destructive' : '',
                        )}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Set manually or auto-assigned on Reassign IPs.
                      </p>
                    </div>
                  )}

                  {isRouter && (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label htmlFor="mask">Subnet Mask</Label>
                          {errors.mask && (
                            <span className="text-[10px] text-destructive">{errors.mask}</span>
                          )}
                        </div>
                        <Input
                          id="mask"
                          value={mask}
                          onChange={e => setMask(e.target.value)}
                          placeholder="255.255.255.0"
                          className={errors.mask ? 'border-destructive' : ''}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label htmlFor="gateway">Gateway</Label>
                          {errors.gateway && (
                            <span className="text-[10px] text-destructive">{errors.gateway}</span>
                          )}
                        </div>
                        <Input
                          id="gateway"
                          value={gateway}
                          onChange={e => setGateway(e.target.value)}
                          placeholder="192.168.1.1"
                          className={errors.gateway ? 'border-destructive' : ''}
                        />
                      </div>
                      <div className="flex items-center justify-between space-y-2 mt-4 pt-4 border-t border-border/50">
                        <Label htmlFor="dhcp_enabled" className="flex flex-col space-y-1">
                          <span>DHCP Server Enabled</span>
                          <span className="font-normal text-[10px] text-muted-foreground w-48">
                            Automatically assign IPs for nodes connected to this router.
                          </span>
                        </Label>
                        <input
                          type="checkbox"
                          id="dhcp_enabled"
                          checked={dhcpEnabled}
                          onChange={e => setDhcpEnabled(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground bg-primary/5 rounded-md px-2 py-1.5 mt-2">
                        Set this router's IP to enable auto-assignment for other nodes.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Site URL */}
        {isNetworked && (
          <div className="space-y-2">
            <Label htmlFor="site">Site</Label>
            <Input
              id="site"
              value={site}
              onChange={e => setSite(e.target.value)}
              placeholder="e.g. https://my-service.local"
            />
          </div>
        )}

        {/* Hardware Specs */}
        <div className="space-y-3 pt-2 border-t">
          {!isVM && nodeHasDynamicPorts(selectedNode.type) && (
            <div className="space-y-1">
              <Label htmlFor="ports" className="text-xs text-muted-foreground">
                Number of Ports
              </Label>
              <Input
                id="ports"
                type="number"
                min={1}
                max={96}
                value={ports}
                onChange={e => setPorts(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. 4, 8, 16, 24"
              />
            </div>
          )}
          {selectedNode.type !== 'internet' && (
            <div className="space-y-1">
              <Label htmlFor="model" className="text-xs text-muted-foreground">
                Model
              </Label>
              <Input
                id="model"
                value={model}
                onChange={e => setModel(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. Raspberry Pi 4"
              />
            </div>
          )}

          {nodeHasCPU(selectedNode.type) && (
            <div className="space-y-1">
              <Label htmlFor="cpu" className="text-xs text-muted-foreground">
                CPU Cores
              </Label>
              <Input
                id="cpu"
                type="number"
                min="1"
                step="1"
                value={cpu}
                onChange={e => setCpu(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. 4"
              />
            </div>
          )}

          {nodeHasRAM(selectedNode.type) && (
            <div className="space-y-1">
              <Label htmlFor="ram" className="text-xs text-muted-foreground">
                {selectedNode.type === 'gpu' ? 'VRAM' : 'RAM'} capacity
              </Label>
              <div className="flex gap-1">
                <Input
                  id="ram"
                  type="number"
                  min="1"
                  value={ram}
                  onChange={e => setRam(e.target.value)}
                  className="h-8 text-xs flex-1"
                  placeholder="e.g. 16"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 w-10.5 font-mono text-xs cursor-pointer bg-muted/30 shrink-0"
                  onClick={() => setRamUnit(prev => (prev === 'GB' ? 'TB' : 'GB'))}
                >
                  {ramUnit}
                </Button>
              </div>
            </div>
          )}

          {nodeHasStorage(selectedNode.type) && (
            <div className="space-y-1">
              <Label htmlFor="storage" className="text-xs text-muted-foreground">
                Storage capacity
              </Label>
              <div className="flex gap-1">
                <Input
                  id="storage"
                  type="number"
                  min="1"
                  value={storage}
                  onChange={e => setStorage(e.target.value)}
                  className="h-8 text-xs flex-1"
                  placeholder="e.g. 512"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 w-10.5 font-mono text-xs cursor-pointer bg-muted/30 shrink-0"
                  onClick={() => setStorageUnit(prev => (prev === 'GB' ? 'TB' : 'GB'))}
                >
                  {storageUnit}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Component Manager (GPUs, Disks, etc) — only for non-VM nodes */}
        {!isVM && <InternalComponentManager nodeId={selectedNode.id} />}

        {/* Kubernetes enrollment */}
        {isComputeNode(selectedNode.type) && <K8sEnrollmentSection nodeId={selectedNode.id} />}

        {/* Add VM button for host nodes */}
        {supportsVMs && (
          <div className="border-t pt-4">
            {hasWarning && (
              <div className="mb-4 p-2.5 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-0.5">Resource Warning</p>
                  <p className="opacity-90 leading-relaxed">
                    This node is over-provisioned.
                    {cpuWarning && ` Used CPU: ${usedCpu}/${totalCpu}.`}
                    {ramWarning &&
                      ` Used RAM: ${Math.round(usedRam / 1024)}GB/${Math.round(totalRamMB / 1024)}GB.`}
                  </p>
                </div>
              </div>
            )}

            {childVMs.length > 0 && (
              <div className="mb-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-violet-400 font-medium">
                  Virtual Machines ({childVMs.length})
                </p>
                {childVMs.map(vm => (
                  <div
                    key={vm.id}
                    className="flex items-center gap-2 p-2 rounded border border-violet-500/20 bg-violet-500/5 cursor-pointer hover:bg-violet-500/10 transition-colors"
                    onClick={() => selectNode(vm.id)}
                  >
                    <Server className="h-3 w-3 text-violet-400 shrink-0" />
                    <span className="text-xs font-medium truncate flex-1">{vm.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {vm.ip || 'no IP'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs border-dashed border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
              onClick={handleAddVM}
            >
              <Plus className="h-3 w-3 mr-1.5" />
              Add Virtual Machine
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
