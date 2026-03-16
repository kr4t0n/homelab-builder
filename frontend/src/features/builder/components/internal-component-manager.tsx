import { useState } from "react"
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
import { Button } from "../../../components/ui/button"
import { Badge } from "../../../components/ui/badge"
import { Trash2, HardDrive, Cpu, ScanLine, CircuitBoard, Component, Zap, Archive, Pencil, GripVertical } from "lucide-react"
import type { HardwareType, HardwareComponent, HardwareNode } from "../../../types"
import { ComponentDetailsDialog } from "./component-details-dialog"
import { ConfirmDialog } from "../../../components/ui/confirm-dialog"

const COMPONENT_ICONS: Partial<Record<HardwareType, React.ElementType>> = {
    disk: HardDrive,
    gpu: ScanLine,
    hba: CircuitBoard,
    pcie: Component,
    ups: Zap,
    minipc: Cpu,
    sbc: Cpu,
    server: Archive,
    nas: Archive,
    router: Component,
    switch: Component,
}

interface Props {
    nodeId: string
}

function SortableComponent({
    comp,
    childVMs,
    onEdit,
    onDelete,
    onPassthrough,
}: {
    comp: HardwareComponent
    childVMs: HardwareNode[]
    onEdit: (comp: HardwareComponent) => void
    onDelete: (id: string) => void
    onPassthrough: (componentId: string, vmId: string | undefined) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: comp.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.5 : 1,
    }

    const Icon = COMPONENT_ICONS[comp.type] || Component
    const ptVm = comp.passthrough_to ? childVMs.find(v => v.id === comp.passthrough_to) : null

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex flex-col gap-1.5 rounded-lg border bg-background/60 p-2.5 group"
        >
            <div className="flex items-start gap-2">
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
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(comp)}>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate hover:underline underline-offset-2 decoration-muted-foreground/50">
                            {comp.name}
                        </span>
                        <Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0 uppercase opacity-70">
                            {comp.type}
                        </Badge>
                        {ptVm && (
                            <Badge className="text-[9px] h-3.5 px-1 shrink-0 bg-violet-500/20 text-violet-400 border-violet-500/30">
                                PT → {ptVm.name}
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground truncate">
                        {comp.details?.model && <span>{comp.details.model}</span>}
                        {comp.details?.ram && <span>{comp.details.ram} {comp.type === 'gpu' ? 'VRAM' : ''}</span>}
                        {comp.details?.storage && <span>{comp.details.storage}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={() => onEdit(comp)}
                        title="Edit component"
                    >
                        <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(comp.id);
                        }}
                        title="Remove component"
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
            </div>
            {childVMs.length > 0 && (
                <div className="flex items-center gap-1.5 pl-7">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Passthrough:</span>
                    <select
                        className="h-6 text-[10px] rounded border bg-background px-1.5 flex-1 min-w-0"
                        value={comp.passthrough_to || ''}
                        onChange={e => onPassthrough(comp.id, e.target.value || undefined)}
                    >
                        <option value="">None</option>
                        {childVMs.map(vm => (
                            <option key={vm.id} value={vm.id}>{vm.name}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    )
}

export function InternalComponentManager({ nodeId }: Props) {
    const { hardwareNodes, removeInternalComponent, updateInternalComponent, reorderInternalComponents, setPassthrough } = useBuilderStore()
    const node = hardwareNodes.find(n => n.id === nodeId)
    const components = node?.internal_components || []
    const childVMs = hardwareNodes.filter(n => n.parent_id === nodeId)
    
    const [editingComponent, setEditingComponent] = useState<HardwareComponent | null>(null)
    const [deletingCompId, setDeletingCompId] = useState<string | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = components.findIndex(c => c.id === active.id)
        const newIndex = components.findIndex(c => c.id === over.id)
        const reordered = arrayMove(components, oldIndex, newIndex)
        reorderInternalComponents(nodeId, reordered.map(c => c.id))
    }

    if (components.length === 0) return null

    return (
        <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Internal Components ({components.length})
                </h4>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={components.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                        {components.map(comp => (
                            <SortableComponent
                                key={comp.id}
                                comp={comp}
                                childVMs={childVMs}
                                onEdit={setEditingComponent}
                                onDelete={setDeletingCompId}
                                onPassthrough={(compId, vmId) => setPassthrough(nodeId, compId, vmId)}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Edit Dialog */}
            {editingComponent && (
                <ComponentDetailsDialog
                    open={true}
                    onOpenChange={(v) => !v && setEditingComponent(null)}
                    initialType={editingComponent.type}
                    initialName={editingComponent.name}
                    initialDetails={editingComponent.details}
                    onConfirm={(data) => {
                        updateInternalComponent(nodeId, editingComponent.id, {
                            name: data.name,
                            details: data.details
                        })
                        setEditingComponent(null)
                    }}
                />
            )}

            {/* Delete Confirm Dialog */}
            <ConfirmDialog
                open={deletingCompId !== null}
                onOpenChange={(v) => !v && setDeletingCompId(null)}
                title="Remove component?"
                description="This action cannot be undone."
                confirmLabel="Remove"
                onConfirm={() => {
                    if (deletingCompId) removeInternalComponent(nodeId, deletingCompId)
                    setDeletingCompId(null)
                }}
            />
        </div>
    )
}
