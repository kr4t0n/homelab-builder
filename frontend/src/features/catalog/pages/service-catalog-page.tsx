import { useState, useMemo } from 'react';
import { useBuilderStore } from '../../builder/store/builder-store';
import { useUserSelections, useAddSelection, useRemoveSelection } from '../api/use-services';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Search, Heart, Package, Book, Globe, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../components/ui/dialog';
import type { Service, ServiceCategory } from '../../../types';
import { Github } from '../../../components/icons/github';
import { api } from '../../../services/api';
import { toast } from 'sonner';

function ServiceCard({
  item,
  isFavorite,
  selectionId,
  onDelete,
}: {
  item: Service;
  isFavorite: boolean;
  selectionId?: string;
  onDelete?: (id: string) => void;
}) {
  const addSelection = useAddSelection();
  const removeSelection = useRemoveSelection();

  const handleFavorite = () => {
    if (isFavorite && selectionId) {
      removeSelection.mutate(selectionId);
    } else {
      addSelection.mutate(item.id);
    }
  };

  const tagsArray: string[] = Array.isArray(item.tags)
    ? item.tags
    : typeof item.tags === 'string'
      ? JSON.parse(item.tags || '[]')
      : [];

  return (
    <div className="group rounded-xl border bg-card hover:border-primary/40 transition-all duration-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 flex items-start gap-4 flex-1">
        <div className="p-2.5 rounded-lg shrink-0 text-blue-500 bg-blue-500/10">
          <Package className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 max-w-full">
            <div className="truncate">
              <h3 className="font-semibold text-base truncate">{item.name}</h3>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{item.category}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={handleFavorite}
                className={`p-1.5 rounded-md hover:bg-muted/60 transition-colors hover:cursor-pointer ${isFavorite ? 'text-red-500 hover:text-red-400' : 'text-muted-foreground hover:text-red-400'}`}
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500' : ''}`} />
              </button>
              {onDelete && (
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors hover:cursor-pointer text-muted-foreground hover:text-destructive"
                  title="Delete service"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-foreground/80 mt-2 line-clamp-3">
            {item.description || 'No description provided.'}
          </p>
        </div>
      </div>

      <div className="border-t px-4 py-3 bg-muted/20 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex gap-1.5 flex-wrap">
          {tagsArray.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium border"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          {item.official_website && (
            <a
              href={item.official_website}
              target="_blank"
              rel="noreferrer"
              title="Website"
              className="hover:text-primary transition-colors"
            >
              <Globe className="h-4 w-4" />
            </a>
          )}
          {item.docs_url && (
            <a
              href={item.docs_url}
              target="_blank"
              rel="noreferrer"
              title="Documentation"
              className="hover:text-primary transition-colors"
            >
              <Book className="h-4 w-4" />
            </a>
          )}
          {item.github_url && (
            <a
              href={item.github_url}
              target="_blank"
              rel="noreferrer"
              title="GitHub"
              className="hover:text-primary transition-colors"
            >
              <Github className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const SERVICE_CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: 'media', label: 'Media' },
  { value: 'networking', label: 'Networking' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'storage', label: 'Storage' },
  { value: 'management', label: 'Management' },
  { value: 'home_automation', label: 'Home Automation' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'other', label: 'Other' },
];

function AddServiceCard() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { fetchServices } = useBuilderStore();
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'other' as ServiceCategory,
    official_website: '',
    docs_url: '',
    github_url: '',
    tags: '',
    docker_support: true,
  });

  const resetForm = () =>
    setForm({
      name: '',
      description: '',
      category: 'other',
      official_website: '',
      docs_url: '',
      github_url: '',
      tags: '',
      docker_support: true,
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Service name is required');
      return;
    }
    setSubmitting(true);
    try {
      await api.createService({
        ...form,
        tags: JSON.stringify(
          form.tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean),
        ),
      });
      toast.success(`"${form.name}" added to the library`);
      resetForm();
      setOpen(false);
      fetchServices();
    } catch {
      toast.error('Failed to add service');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-all duration-200 flex flex-col items-center justify-center h-full min-h-[200px] cursor-pointer hover:bg-muted/30"
      >
        <div className="p-3 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors mb-3">
          <Plus className="h-8 w-8 text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </div>
        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          Add Service
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Service</DialogTitle>
            <DialogDescription>
              Add a self-hosted service to the library.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="svc-name">Name *</Label>
                <Input
                  id="svc-name"
                  placeholder="e.g. Nextcloud"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-category">Category</Label>
                <select
                  id="svc-category"
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value as ServiceCategory }))}
                >
                  {SERVICE_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="svc-desc">Description</Label>
              <textarea
                id="svc-desc"
                rows={3}
                placeholder="Brief description of the service..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="svc-website">Website</Label>
                <Input
                  id="svc-website"
                  placeholder="https://..."
                  value={form.official_website}
                  onChange={e => setForm(p => ({ ...p, official_website: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-github">GitHub URL</Label>
                <Input
                  id="svc-github"
                  placeholder="https://github.com/..."
                  value={form.github_url}
                  onChange={e => setForm(p => ({ ...p, github_url: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="svc-docs">Docs URL</Label>
              <Input
                id="svc-docs"
                placeholder="https://docs.example.com"
                value={form.docs_url}
                onChange={e => setForm(p => ({ ...p, docs_url: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="svc-tags">Tags (comma-separated)</Label>
              <Input
                id="svc-tags"
                placeholder="e.g. cloud, files, sync"
                value={form.tags}
                onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="svc-docker"
                type="checkbox"
                checked={form.docker_support}
                onChange={e => setForm(p => ({ ...p, docker_support: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="svc-docker" className="text-sm cursor-pointer">
                Supports Docker
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add Service'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ServiceCatalogPage() {
  const { availableServices, fetchServices } = useBuilderStore();
  const { data: selectionsData, isLoading } = useUserSelections();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteService(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" removed from the library`);
      setDeleteTarget(null);
      fetchServices();
    } catch {
      toast.error('Failed to delete service');
    } finally {
      setDeleting(false);
    }
  };

  if (availableServices.length === 0) {
    fetchServices(); // Ensure they are loaded if arriving directly
  }

  const selections = selectionsData?.data || [];
  const favSet = useMemo(() => {
    const map = new Map<string, string>();
    selections.forEach(s => map.set(s.service_id, s.id));
    return map;
  }, [selections]);

  // Filter Logic
  const items = useMemo(() => {
    let res = availableServices;
    if (category === 'favorites') {
      res = res.filter(s => favSet.has(s.id));
    } else if (category && category !== 'all') {
      res = res.filter(s => s.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const lowSearch = search.toLowerCase();
      res = res.filter(
        s =>
          s.name.toLowerCase().includes(lowSearch) ||
          s.description?.toLowerCase().includes(lowSearch),
      );
    }
    return res;
  }, [availableServices, category, search, favSet]);

  const categories = useMemo(() => {
    const cats = new Set(availableServices.map(s => s.category));
    return Array.from(cats).sort();
  }, [availableServices]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8 px-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Library</h1>
          <p className="text-muted-foreground mt-1">
            Discover and favorite self-hosted services for your homelab
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!category || category === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
        >
          All
        </button>
        <button
          onClick={() => setCategory('favorites')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:cursor-pointer ${category === 'favorites' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'border-border hover:bg-muted'}`}
        >
          <Heart className={`h-3 w-3 ${category === 'favorites' ? 'fill-red-500' : ''}`} />
          Favorites
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat === category ? '' : cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-colors ${cat === category ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {items.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Book className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">No services found</h3>
          <p className="text-muted-foreground text-sm">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(item => (
            <ServiceCard
              key={item.id}
              item={item}
              isFavorite={favSet.has(item.id)}
              selectionId={favSet.get(item.id)}
              onDelete={id => {
                const svc = availableServices.find(s => s.id === id);
                if (svc) setDeleteTarget(svc);
              }}
            />
          ))}
          <AddServiceCard />
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
