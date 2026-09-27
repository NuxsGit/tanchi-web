import {
  GRID_COLS,
  GRID_ROWS,
  clamp,
  defaultLayout,
  findSlot,
  isFree,
  specOf,
  type DashboardLayout,
  type Rect,
  type WidgetInstance,
  type WidgetOptions,
  type WidgetType
} from '~~/shared/dashboard'

export interface DashboardData {
  teams: { id: number, name: string, role: string, memberCount: number }[]
  projects: Record<string, number | string>[]
  myTasks: Record<string, unknown>[]
  members: Record<string, unknown>[]
  fmd: { matrices: number, flows: number, allow: number, deny: number, conflicts: number }
}

/** Grille personnalisable du tableau de bord : état, placement, persistance. */
export const useDashboard = () => {
  const toast = useToast()

  const widgets = useState<WidgetInstance[]>('dash-widgets', () => [])
  const data = useState<DashboardData | null>('dash-data', () => null)
  const loaded = useState<boolean>('dash-loaded', () => false)
  const editing = useState<boolean>('dash-editing', () => false)
  const saving = ref(false)

  /** Rectangle prévisualisé pendant un déplacement ou un redimensionnement. */
  const ghost = ref<(Rect & { valid: boolean }) | null>(null)

  async function load() {
    if (loaded.value) return
    try {
      const [layout, payload] = await Promise.all([
        $fetch<{ layout: DashboardLayout }>('/api/dashboard/layout'),
        $fetch<DashboardData>('/api/dashboard/data')
      ])
      widgets.value = layout.layout.widgets
      data.value = payload
    } catch {
      widgets.value = defaultLayout().widgets
      toast.add({ title: 'Tableau de bord partiellement chargé', color: 'warning' })
    } finally {
      loaded.value = true
    }
  }

  async function refreshData() {
    try {
      data.value = await $fetch<DashboardData>('/api/dashboard/data')
    } catch {
      // Widgets déjà affichés : on garde les dernières valeurs connues.
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined

  /** Sauvegarde différée : un déplacement en rafale ne déclenche qu'un envoi. */
  function persist() {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      saving.value = true
      try {
        await $fetch('/api/dashboard/layout', {
          method: 'PUT',
          body: { layout: { widgets: widgets.value } }
        })
      } catch {
        toast.add({ title: 'Grille non enregistrée', color: 'error' })
      } finally {
        saving.value = false
      }
    }, 600)
  }

  function stopPersisting() {
    clearTimeout(timer)
  }

  /* ------------------------------------------------------------- Placement */

  function place(type: WidgetType, options?: WidgetOptions): boolean {
    const spec = specOf(type)
    if (!spec) return false

    const slot = findSlot(spec.defaultSize, widgets.value)
    if (!slot) {
      toast.add({
        title: 'Grille pleine',
        description: 'Déplacez ou retirez un widget pour libérer de la place.',
        color: 'warning'
      })
      return false
    }

    widgets.value = [
      ...widgets.value,
      { id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, type, ...slot, options }
    ]
    persist()
    return true
  }

  function remove(id: string) {
    widgets.value = widgets.value.filter(widget => widget.id !== id)
    persist()
  }

  function updateOptions(id: string, options: WidgetOptions) {
    widgets.value = widgets.value.map(widget =>
      widget.id === id ? { ...widget, options: { ...widget.options, ...options } } : widget
    )
    persist()
  }

  /** Applique un rectangle si l'emplacement est libre. */
  function apply(id: string, rect: Rect): boolean {
    if (!isFree(rect, widgets.value, id)) return false
    widgets.value = widgets.value.map(widget =>
      widget.id === id ? { ...widget, ...rect } : widget
    )
    persist()
    return true
  }

  /** Rectangle candidat au déplacement, borné à la grille. */
  function previewMove(widget: WidgetInstance, dx: number, dy: number): Rect {
    return {
      x: clamp(widget.x + dx, 0, GRID_COLS - widget.w),
      y: clamp(widget.y + dy, 0, GRID_ROWS - widget.h),
      w: widget.w,
      h: widget.h
    }
  }

  /** Rectangle candidat au redimensionnement, borné par la taille minimale. */
  function previewResize(widget: WidgetInstance, dw: number, dh: number): Rect {
    const spec = specOf(widget.type)
    const minW = spec?.minSize.w ?? 1
    const minH = spec?.minSize.h ?? 1

    return {
      x: widget.x,
      y: widget.y,
      w: clamp(widget.w + dw, minW, GRID_COLS - widget.x),
      h: clamp(widget.h + dh, minH, GRID_ROWS - widget.y)
    }
  }

  function reset() {
    widgets.value = defaultLayout().widgets
    persist()
    toast.add({ title: 'Grille réinitialisée', color: 'success' })
  }

  const occupancy = computed(() => {
    const used = widgets.value.reduce((sum, widget) => sum + widget.w * widget.h, 0)
    return Math.round((used / (GRID_COLS * GRID_ROWS)) * 100)
  })

  return {
    widgets, data, loaded, editing, saving, ghost, occupancy,
    load, refreshData, place, remove, updateOptions, apply,
    previewMove, previewResize, reset, persist, stopPersisting
  }
}
