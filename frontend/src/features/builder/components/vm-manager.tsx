import { useState } from "react"
import { v4 as uuidv4 } from 'uuid'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useBuilderStore } from "../store/builder-store"
import type { VirtualMachine, VMType, HardwareComponent, K8sRole } from "../../../types"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Badge } from "../../../components/ui/badge"
import { Plus, Trash2, Cpu, Box, Container, Wifi, Pencil, Check, X, Shield, GripVertical, Network } from "lucide-react"
import { cn } from "../../../lib/utils"

const VM_TYPE_ICONS: Record<VMType, React.ElementType> = {
    vm: Cpu,
    container: Container,
    lxc: Box,
}

const STATUS_COLORS = {
    running: 'bg-green-500',
    stopped: 'bg-red-500',
    paused: 'bg-yellow-500',
}

interface Props {
    nodeId: string
}

const PT_TYPE_LABEL: Record<string, string> = {
    gpu: 'GPU', hba: 'HBA', pcie: 'PCIe', disk: 'Disk',
}

function PassthroughSelector({
    components,
    selected,
    onToggle,
    takenByOther,
}: {
    components: HardwareComponent[]
    selected: string[]
    onToggle: (id: string) => void
    takenByOther: Set<string>
}) {
    if (components.length === 0) return null
    return (
        <div>
            <Label className="text-[10px]">Passthrough Components</Label>
            <div className="flex flex-wrap gap-1 mt-1">
                {components.map(c => {
                    const isSelected = selected.includes(c.id)
                    const isTaken = takenByOther.has(c.id)
                    return (
                        <button
                            key={c.id}
                            type="button"
                            disabled={isTaken}
                            onClick={() => onToggle(c.id)}
                            className={cn(
                                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                                isSelected
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                    : isTaken
                                        ? 'bg-muted/30 text-muted-foreground/40 border-muted cursor-not-allowed'
                                        : 'bg-muted/30 text-muted-foreground border-border hover:border-amber-500/40 hover:text-amber-400',
                            )}
                            title={isTaken ? `Assigned to another VM` : c.name}
                        >
                            {PT_TYPE_LABEL[c.type] || c.type.toUpperCase()}: {c.name}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function VmK8sBadge({ nodeId, vmId }: { nodeId: string; vmId: string }) {
    const { k8sClusters, k8sMembers, enrollInK8s, unenrollFromK8s } = useBuilderStore();
    const membership = k8sMembers.find(m => m.node_id === nodeId && m.vm_id === vmId);
    const cluster = membership ? k8sClusters.find(c => c.id === membership.cluster_id) : null;

    if (k8sClusters.length === 0) return null;

    return (
        <div className="flex items-center gap-1 mt-1">
            <Network className="h-2.5 w-2.5 text-violet-400 shrink-0" />
            <select
                className="h-5 text-[9px] rounded border bg-background px-1 min-w-0"
                value={membership?.cluster_id || ''}
                onChange={e => {
                    const val = e.target.value;
                    if (!val) unenrollFromK8s(nodeId, vmId);
                    else enrollInK8s(nodeId, vmId, val, membership?.role || 'worker');
                }}
            >
                <option value="">None</option>
                {k8sClusters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            {membership && (
                <select
                    className="h-5 text-[9px] rounded border bg-background px-1 w-16"
                    value={membership.role}
                    onChange={e => enrollInK8s(nodeId, vmId, membership.cluster_id, e.target.value as K8sRole)}
                >
                    <option value="master">Master</option>
                    <option value="worker">Worker</option>
                </select>
            )}
            {cluster && (
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cluster.color }} />
            )}
        </div>
    );
}

function SortableVM({
    vm,
    isEditing,
    editVM,
    setEditVM,
    saveEdit,
    cancelEdit,
    startEditing,
    cycleStatus,
    removeVM,
    nodeId,
    hostComponents,
    takenByOtherVM,
    togglePassthrough,
    tailscaleEnabled,
}: {
    vm: VirtualMachine
    isEditing: boolean
    editVM: Partial<VirtualMachine>
    setEditVM: React.Dispatch<React.SetStateAction<Partial<VirtualMachine>>>
    saveEdit: () => void
    cancelEdit: () => void
    startEditing: (vm: VirtualMachine) => void
    cycleStatus: (vm: VirtualMachine) => void
    removeVM: (nodeId: string, vmId: string) => void
    nodeId: string
    hostComponents: HardwareComponent[]
    takenByOtherVM: (excludeVmId?: string) => Set<string>
    togglePassthrough: (list: string[], id: string) => string[]
    tailscaleEnabled: boolean
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: vm.id, disabled: isEditing })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.5 : 1,
    }

    const Icon = VM_TYPE_ICONS[vm.type] || Box

    if (isEditing) {
        return (
            <div ref={setNodeRef} style={style} className="rounded-lg border border-primary/50 bg-muted/30 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label className="text-[10px]">Name</Label>
                        <Input
                            className="h-7 text-xs"
                            value={editVM.name}
                            onChange={e => setEditVM(p => ({ ...p, name: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label className="text-[10px]">Type</Label>
                        <select
                            className="w-full h-7 text-xs rounded-md border bg-background px-2"
                            value={editVM.type}
                            onChange={e => setEditVM(p => ({ ...p, type: e.target.value as VMType }))}
                        >
                            <option value="container">Container</option>
                            <option value="vm">VM</option>
                            <option value="lxc">LXC</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label className="text-[10px]">OS / Image</Label>
                        <Input
                            className="h-7 text-xs"
                            placeholder="Ubuntu 22.04"
                            value={editVM.os}
                            onChange={e => setEditVM(p => ({ ...p, os: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label className="text-[10px]">IP (auto if blank)</Label>
                        <Input
                            className="h-7 text-xs"
                            placeholder="auto"
                            value={editVM.ip}
                            onChange={e => setEditVM(p => ({ ...p, ip: e.target.value }))}
                        />
                    </div>
                </div>
                {tailscaleEnabled && (
                    <div>
                        <Label className="text-[10px] flex items-center gap-1 text-blue-400">
                            <Shield className="h-2.5 w-2.5" /> Tailscale IP
                        </Label>
                        <Input
                            className="h-7 text-xs font-mono text-blue-300 bg-blue-950/20 border-blue-500/30"
                            placeholder="auto"
                            value={editVM.tailscale_ip}
                            onChange={e => setEditVM(p => ({ ...p, tailscale_ip: e.target.value }))}
                        />
                    </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label className="text-[10px]">CPU Cores</Label>
                        <Input
                            className="h-7 text-xs"
                            type="number"
                            min={1}
                            max={32}
                            value={editVM.cpu_cores}
                            onChange={e => setEditVM(p => ({ ...p, cpu_cores: Number(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <Label className="text-[10px]">RAM (MB)</Label>
                        <Input
                            className="h-7 text-xs"
                            type="number"
                            min={128}
                            step={128}
                            value={editVM.ram_mb}
                            onChange={e => setEditVM(p => ({ ...p, ram_mb: Number(e.target.value) }))}
                        />
                    </div>
                </div>
                {hostComponents.length > 0 && (
                    <PassthroughSelector
                        components={hostComponents}
                        selected={editVM.passthrough || []}
                        onToggle={id => setEditVM(p => ({ ...p, passthrough: togglePassthrough(p.passthrough || [], id) }))}
                        takenByOther={takenByOtherVM(vm.id)}
                    />
                )}
                <div className="flex gap-2 pt-1">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={saveEdit}>
                        <Check className="h-3 w-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit}>
                        <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div ref={setNodeRef} style={style} className="flex items-start gap-2 rounded-lg border bg-background/60 p-2.5">
            <button
                className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-3.5 w-3.5" />
            </button>
            <div className="mt-0.5 shrink-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate">{vm.name}</span>
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0">
                        {vm.type.toUpperCase()}
                    </Badge>
                </div>
                {vm.os && <p className="text-[10px] text-muted-foreground">{vm.os}</p>}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {vm.ip && (
                        <span className="flex items-center gap-0.5 text-[10px] text-primary font-mono">
                            <Wifi className="h-2.5 w-2.5" />{vm.ip}
                        </span>
                    )}
                    {tailscaleEnabled && vm.tailscale_ip && (
                        <span className="flex items-center gap-0.5 text-[10px] text-blue-400 font-mono">
                            <Shield className="h-2.5 w-2.5" />{vm.tailscale_ip}
                        </span>
                    )}
                    {vm.cpu_cores && (
                        <span className="text-[10px] text-muted-foreground">{vm.cpu_cores}vCPU</span>
                    )}
                    {vm.ram_mb && (
                        <span className="text-[10px] text-muted-foreground">{vm.ram_mb >= 1024 ? `${vm.ram_mb/1024}GB` : `${vm.ram_mb}MB`} RAM</span>
                    )}
                </div>
                {(vm.passthrough?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1">
                        {vm.passthrough!.map(id => {
                            const comp = hostComponents.find(c => c.id === id)
                            if (!comp) return null
                            return (
                                <span
                                    key={id}
                                    className="inline-flex items-center rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1 py-px text-[9px] font-semibold"
                                    title={comp.name}
                                >
                                    {PT_TYPE_LABEL[comp.type] || comp.type.toUpperCase()}: {comp.name}
                                </span>
                            )
                        })}
                    </div>
                )}
                <VmK8sBadge nodeId={nodeId} vmId={vm.id} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={() => cycleStatus(vm)}
                    className={`h-4 w-4 rounded-full ${STATUS_COLORS[vm.status]} hover:opacity-80 transition-opacity`}
                    title={`Status: ${vm.status}. Click to toggle.`}
                />
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={() => startEditing(vm)}
                    title="Edit"
                >
                    <Pencil className="h-3 w-3" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeVM(nodeId, vm.id)}
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>
        </div>
    )
}

export function VMManager({ nodeId }: Props) {
    const { hardwareNodes, addVM, removeVM, updateVM, reorderVMs, tailscaleEnabled } = useBuilderStore()
    const node = hardwareNodes.find(n => n.id === nodeId)
    const vms = node?.vms || []
    const hostComponents = node?.internal_components || []

    const takenByOtherVM = (excludeVmId?: string) => {
        const taken = new Set<string>()
        for (const vm of vms) {
            if (vm.id === excludeVmId) continue
            for (const id of vm.passthrough || []) taken.add(id)
        }
        return taken
    }

    const [isAdding, setIsAdding] = useState(false)
    const [editingVmId, setEditingVmId] = useState<string | null>(null)
    const [editVM, setEditVM] = useState<Partial<VirtualMachine>>({})
    const [newVM, setNewVM] = useState<Partial<VirtualMachine>>({
        type: 'container',
        status: 'running',
        name: '',
        os: '',
        ip: '',
        tailscale_ip: '',
        cpu_cores: 1,
        ram_mb: 512,
        passthrough: [],
    })

    const togglePassthrough = (list: string[], id: string) =>
        list.includes(id) ? list.filter(x => x !== id) : [...list, id]

    const handleAdd = () => {
        if (!newVM.name?.trim()) return
        addVM(nodeId, {
            id: uuidv4(),
            name: newVM.name!,
            type: newVM.type as VMType || 'container',
            status: newVM.status as VirtualMachine['status'] || 'running',
            ip: newVM.ip || undefined,
            tailscale_ip: newVM.tailscale_ip || undefined,
            os: newVM.os || undefined,
            cpu_cores: newVM.cpu_cores,
            ram_mb: newVM.ram_mb,
            passthrough: newVM.passthrough?.length ? newVM.passthrough : undefined,
        })
        setIsAdding(false)
        setNewVM({ type: 'container', status: 'running', name: '', os: '', ip: '', tailscale_ip: '', cpu_cores: 1, ram_mb: 512, passthrough: [] })
    }

    const cycleStatus = (vm: VirtualMachine) => {
        const next: Record<string, VirtualMachine['status']> = {
            running: 'stopped',
            stopped: 'running',
            paused: 'running',
        }
        updateVM(nodeId, vm.id, { status: next[vm.status] })
    }

    const startEditing = (vm: VirtualMachine) => {
        setEditingVmId(vm.id)
        setEditVM({
            name: vm.name,
            type: vm.type,
            os: vm.os || '',
            ip: vm.ip || '',
            tailscale_ip: vm.tailscale_ip || '',
            cpu_cores: vm.cpu_cores || 1,
            ram_mb: vm.ram_mb || 512,
            passthrough: vm.passthrough || [],
        })
    }

    const saveEdit = () => {
        if (!editingVmId || !editVM.name?.trim()) return
        updateVM(nodeId, editingVmId, {
            name: editVM.name!,
            type: editVM.type as VMType || 'container',
            os: editVM.os || undefined,
            ip: editVM.ip || undefined,
            tailscale_ip: editVM.tailscale_ip || undefined,
            cpu_cores: editVM.cpu_cores,
            ram_mb: editVM.ram_mb,
            passthrough: editVM.passthrough?.length ? editVM.passthrough : undefined,
        })
        setEditingVmId(null)
        setEditVM({})
    }

    const cancelEdit = () => {
        setEditingVmId(null)
        setEditVM({})
    }

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = vms.findIndex(v => v.id === active.id)
        const newIndex = vms.findIndex(v => v.id === over.id)
        const reordered = arrayMove(vms, oldIndex, newIndex)
        reorderVMs(nodeId, reordered.map(v => v.id))
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    VMs & Containers ({vms.length})
                </h4>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setIsAdding(!isAdding)}
                >
                    <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
            </div>

            {/* Add form */}
            {isAdding && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-[10px]">Name</Label>
                            <Input
                                className="h-7 text-xs"
                                placeholder="e.g. nginx"
                                value={newVM.name}
                                onChange={e => setNewVM(p => ({ ...p, name: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label className="text-[10px]">Type</Label>
                            <select
                                className="w-full h-7 text-xs rounded-md border bg-background px-2"
                                value={newVM.type}
                                onChange={e => setNewVM(p => ({ ...p, type: e.target.value as VMType }))}
                            >
                                <option value="container">Container</option>
                                <option value="vm">VM</option>
                                <option value="lxc">LXC</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-[10px]">OS / Image</Label>
                            <Input
                                className="h-7 text-xs"
                                placeholder="Ubuntu 22.04"
                                value={newVM.os}
                                onChange={e => setNewVM(p => ({ ...p, os: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label className="text-[10px]">IP (auto if blank)</Label>
                            <Input
                                className="h-7 text-xs"
                                placeholder="auto"
                                value={newVM.ip}
                                onChange={e => setNewVM(p => ({ ...p, ip: e.target.value }))}
                            />
                        </div>
                    </div>
                    {tailscaleEnabled && (
                        <div>
                            <Label className="text-[10px] flex items-center gap-1 text-blue-400">
                                <Shield className="h-2.5 w-2.5" /> Tailscale IP (auto if blank)
                            </Label>
                            <Input
                                className="h-7 text-xs font-mono text-blue-300 bg-blue-950/20 border-blue-500/30"
                                placeholder="auto"
                                value={newVM.tailscale_ip}
                                onChange={e => setNewVM(p => ({ ...p, tailscale_ip: e.target.value }))}
                            />
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-[10px]">CPU Cores</Label>
                            <Input
                                className="h-7 text-xs"
                                type="number"
                                min={1}
                                max={32}
                                value={newVM.cpu_cores}
                                onChange={e => setNewVM(p => ({ ...p, cpu_cores: Number(e.target.value) }))}
                            />
                        </div>
                        <div>
                            <Label className="text-[10px]">RAM (MB)</Label>
                            <Input
                                className="h-7 text-xs"
                                type="number"
                                min={128}
                                step={128}
                                value={newVM.ram_mb}
                                onChange={e => setNewVM(p => ({ ...p, ram_mb: Number(e.target.value) }))}
                            />
                        </div>
                    </div>
                    {hostComponents.length > 0 && (
                        <PassthroughSelector
                            components={hostComponents}
                            selected={newVM.passthrough || []}
                            onToggle={id => setNewVM(p => ({ ...p, passthrough: togglePassthrough(p.passthrough || [], id) }))}
                            takenByOther={takenByOtherVM()}
                        />
                    )}
                    <div className="flex gap-2 pt-1">
                        <Button size="sm" className="h-7 text-xs flex-1" onClick={handleAdd}>
                            Add {newVM.type === 'vm' ? 'VM' : newVM.type === 'lxc' ? 'LXC' : 'Container'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsAdding(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* VM list */}
            {vms.length === 0 && !isAdding && (
                <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                    No VMs or containers yet. Click Add to create one.
                </p>
            )}

            {vms.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={vms.map(v => v.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                            {vms.map(vm => (
                                <SortableVM
                                    key={vm.id}
                                    vm={vm}
                                    isEditing={editingVmId === vm.id}
                                    editVM={editVM}
                                    setEditVM={setEditVM}
                                    saveEdit={saveEdit}
                                    cancelEdit={cancelEdit}
                                    startEditing={startEditing}
                                    cycleStatus={cycleStatus}
                                    removeVM={removeVM}
                                    nodeId={nodeId}
                                    hostComponents={hostComponents}
                                    takenByOtherVM={takenByOtherVM}
                                    togglePassthrough={togglePassthrough}
                                    tailscaleEnabled={tailscaleEnabled}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    )
}
