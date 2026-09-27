import {
  APP_PROTOCOLS,
  EMPTY_FORM,
  EMPTY_OBJECTS,
  buildBulkAdFlows,
  buildConflictKey,
  buildCsv,
  buildJuniperConfig,
  createMatrix,
  createSection,
  findConflictKeys,
  genId,
  getApplicationProtocol,
  isValidProtocol,
  normalize,
  normalizeImportedFlow,
  normalizeProtocol,
  normalizeWorkspace,
  type Flow,
  type FlowAction,
  type FlowForm,
  type FlowStatus,
  type Matrix,
  type Section,
  type Workspace
} from '~~/shared/fmd'

export type ToolboxTab = 'composer' | 'sections' | 'bulk' | 'export' | 'config'
export type DiagramStatus = 'ACTIVE' | FlowStatus
export type DiagramAction = 'ALL' | FlowAction

/**
 * État et actions de FlowMatrix Designer.
 *
 * Équivalent Vue du composant React `App.tsx` : toute la logique est ici, les
 * composants `FmdXxx.vue` ne font que rendre. L'état est partagé via
 * `useState` afin que le panneau latéral, le tableau et le diagramme voient la
 * même matrice sans passer par une cascade de props.
 */
export const useFmd = () => {
  const toast = useToast()
  const doc = useDocument<Workspace>('fmd')

  /** Portée du document : brouillon personnel ou matrice d'équipe. */
  const scope = useState<'user' | 'team'>('fmd-scope', () => 'user')
  const teamId = useState<number | null>('fmd-team', () => null)
  const scopeRef = computed(() => ({ scope: scope.value, teamId: teamId.value ?? undefined }))

  /* ------------------------------------------------------------ État brut */

  const matrices = useState<Matrix[]>('fmd-matrices', () => [createMatrix()])
  const activeMatrixId = useState<string>('fmd-active-matrix', () => matrices.value[0]!.id)
  const loaded = useState<boolean>('fmd-loaded', () => false)
  const lastSavedAt = useState<string | null>('fmd-saved-at', () => null)
  const saving = useState<boolean>('fmd-saving', () => false)

  const form = useState<FlowForm>('fmd-form', () => ({ ...EMPTY_FORM }))
  const editingFlowId = useState<string | null>('fmd-editing', () => null)

  const tableQuery = useState<string>('fmd-table-query', () => '')
  const diagramQuery = useState<string>('fmd-diagram-query', () => '')
  const diagramStatus = useState<DiagramStatus>('fmd-diagram-status', () => 'ACTIVE')
  const diagramAction = useState<DiagramAction>('fmd-diagram-action', () => 'ALL')
  const selectedRelationKey = useState<string>('fmd-relation', () => '')

  const toolboxTab = useState<ToolboxTab>('fmd-toolbox', () => 'composer')
  const selectedFlowIds = useState<string[]>('fmd-selection', () => [])
  const bulkField = useState<string>('fmd-bulk-field', () => 'action')
  const bulkValue = useState<string>('fmd-bulk-value', () => 'ALLOW')
  const flowsHistory = useState<Flow[][]>('fmd-history', () => [])
  const exportFeedback = useState<string>('fmd-feedback', () => '')

  /* ------------------------------------------------------------ Dérivés */

  const activeMatrix = computed(
    () => matrices.value.find(matrix => matrix.id === activeMatrixId.value) ?? matrices.value[0]!
  )

  const flows = computed(() => activeMatrix.value?.flows ?? [])
  const sections = computed(() => activeMatrix.value?.sections ?? [])
  const objects = computed(() => activeMatrix.value?.objects ?? EMPTY_OBJECTS)

  const addressOptions = computed(() =>
    [...new Set(objects.value.addresses.map(address => address.name))].sort((left, right) =>
      left.localeCompare(right, 'fr', { sensitivity: 'base' })
    )
  )

  const serviceOptions = computed(() =>
    [...new Set([...Object.keys(APP_PROTOCOLS), ...objects.value.services.map(s => s.name)])].sort(
      (left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' })
    )
  )

  const conflictKeys = computed(() => findConflictKeys(flows.value))

  const hasConflict = (flow: Flow) => conflictKeys.value.has(buildConflictKey(flow))

  const stats = computed(() => ({
    total: flows.value.length,
    allow: flows.value.filter(flow => flow.action === 'ALLOW').length,
    deny: flows.value.filter(flow => flow.action === 'DENY').length,
    conflicts: flows.value.filter(hasConflict).length
  }))

  const displayedFlows = computed(() => {
    const query = normalize(tableQuery.value).toLowerCase()
    if (!query) return flows.value

    return flows.value.filter(flow =>
      [
        flow.ruleName, flow.source, flow.nomSource, flow.destination, flow.nomDestination,
        flow.application, flow.protocol, flow.action, flow.status, flow.fromZone,
        flow.toZone, flow.comment
      ].join(' ').toLowerCase().includes(query)
    )
  })

  const relationGroups = computed(() => {
    const query = normalize(diagramQuery.value).toLowerCase()
    const relationMap = new Map<string, { source: string, destination: string, flows: Flow[] }>()

    for (const flow of flows.value) {
      if (!flow.source || !flow.destination) continue
      if (flow.status === 'REJECTED') continue
      if (diagramStatus.value !== 'ACTIVE' && flow.status !== diagramStatus.value) continue
      if (diagramAction.value !== 'ALL' && flow.action !== diagramAction.value) continue

      const source = normalize(flow.source)
      const destination = normalize(flow.destination)
      const matchesQuery =
        !query
        || source.toLowerCase().includes(query)
        || destination.toLowerCase().includes(query)
      if (!matchesQuery) continue

      const key = `${source.toLowerCase()}|${destination.toLowerCase()}`
      const group = relationMap.get(key) ?? { source, destination, flows: [] }
      group.flows.push(flow)
      relationMap.set(key, group)
    }

    return [...relationMap.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) =>
        `${a.source} ${a.destination}`.localeCompare(
          `${b.source} ${b.destination}`, 'fr', { sensitivity: 'base' }
        )
      )
  })

  const selectedRelation = computed(
    () => relationGroups.value.find(relation => relation.key === selectedRelationKey.value) ?? null
  )

  /** Positionne les nœuds sources à gauche et destinations à droite. */
  const diagramGraph = computed(() => {
    const sourceNames = [...new Set(relationGroups.value.map(relation => relation.source))]
    const destinationNames = [...new Set(relationGroups.value.map(relation => relation.destination))]

    const height = Math.max(320, Math.max(sourceNames.length, destinationNames.length) * 96)
    const nodeMap = new Map<string, { x: number, y: number }>()

    sourceNames.forEach((name, index) => {
      nodeMap.set(`source:${name}`, { x: 180, y: 64 + index * 96 })
    })
    destinationNames.forEach((name, index) => {
      nodeMap.set(`destination:${name}`, { x: 780, y: 64 + index * 96 })
    })

    return { width: 960, height, sourceNames, destinationNames, nodeMap }
  })

  const juniperConfig = computed(() => buildJuniperConfig(flows.value))

  const saveStatusLabel = computed(() => {
    if (saving.value) return 'Enregistrement…'
    if (!lastSavedAt.value) return 'Autosauvegarde active'
    const date = new Date(lastSavedAt.value)
    return `Sauvegardé à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  })

  const protocolIsValid = computed(() => !form.value.protocol || isValidProtocol(form.value.protocol))

  const canSubmit = computed(() =>
    Boolean(
      normalize(form.value.source)
      && normalize(form.value.destination)
      && normalize(form.value.protocol)
      && protocolIsValid.value
    )
  )

  /* ------------------------------------------------------------ Mutations */

  function updateActiveMatrix(updater: (matrix: Matrix) => Matrix) {
    matrices.value = matrices.value.map(matrix =>
      matrix.id === activeMatrixId.value
        ? { ...updater(matrix), updatedAt: new Date().toISOString() }
        : matrix
    )
  }

  function pushHistory() {
    const snapshot = [...(activeMatrix.value?.flows ?? [])]
    const next = [...flowsHistory.value, snapshot]
    flowsHistory.value = next.length > 30 ? next.slice(-30) : next
  }

  function undo() {
    if (!flowsHistory.value.length) return
    const previousFlows = flowsHistory.value[flowsHistory.value.length - 1]!
    updateActiveMatrix(matrix => ({ ...matrix, flows: previousFlows }))
    flowsHistory.value = flowsHistory.value.slice(0, -1)
    exportFeedback.value = 'Dernière action annulée.'
  }

  function resetForm() {
    form.value = { ...EMPTY_FORM }
    editingFlowId.value = null
  }

  function submitFlow() {
    if (!canSubmit.value) return
    pushHistory()

    const current = form.value
    const baseFlow: Omit<Flow, 'id' | 'status'> = {
      ruleName: normalize(current.ruleName),
      source: normalize(current.source),
      nomSource: normalize(current.nomSource),
      destination: normalize(current.destination),
      nomDestination: normalize(current.nomDestination),
      application: normalize(current.application),
      protocol: normalizeProtocol(current.protocol),
      action: current.action,
      fromZone: normalize(current.fromZone) || 'TRUST',
      toZone: normalize(current.toZone) || 'SERVERS',
      natSrc: normalize(current.natSrc),
      natDst: normalize(current.natDst),
      comment: normalize(current.comment),
      sectionId: current.sectionId || null
    }

    const wasEditing = Boolean(editingFlowId.value)

    updateActiveMatrix((matrix) => {
      const flowsNext = [...matrix.flows]
      const index = flowsNext.findIndex(flow => flow.id === editingFlowId.value)

      if (index >= 0) flowsNext[index] = { ...flowsNext[index]!, ...baseFlow }
      else flowsNext.push({ id: genId(), status: 'PENDING', ...baseFlow })

      return { ...matrix, flows: flowsNext }
    })

    resetForm()
    toast.add({ title: wasEditing ? 'Flux mis à jour' : 'Flux ajouté', color: 'success' })
  }

  function editFlow(flow: Flow) {
    editingFlowId.value = flow.id
    form.value = {
      ruleName: flow.ruleName,
      source: flow.source,
      nomSource: flow.nomSource,
      destination: flow.destination,
      nomDestination: flow.nomDestination,
      application: flow.application,
      protocol: flow.protocol,
      action: flow.action,
      fromZone: flow.fromZone,
      toZone: flow.toZone,
      natSrc: flow.natSrc,
      natDst: flow.natDst,
      comment: flow.comment,
      sectionId: flow.sectionId ?? ''
    }
    toolboxTab.value = 'composer'
  }

  function duplicateFlow(flowId: string) {
    pushHistory()
    updateActiveMatrix((matrix) => {
      const original = matrix.flows.find(flow => flow.id === flowId)
      if (!original) return matrix
      return { ...matrix, flows: [...matrix.flows, { ...original, id: genId(), status: 'PENDING' }] }
    })
  }

  function deleteFlow(flowId: string) {
    pushHistory()
    updateActiveMatrix(matrix => ({
      ...matrix,
      flows: matrix.flows.filter(flow => flow.id !== flowId)
    }))
    selectedFlowIds.value = selectedFlowIds.value.filter(id => id !== flowId)
    if (editingFlowId.value === flowId) resetForm()
  }

  function updateFlowStatus(flowId: string, status: FlowStatus) {
    pushHistory()
    updateActiveMatrix(matrix => ({
      ...matrix,
      flows: matrix.flows.map(flow => (flow.id === flowId ? { ...flow, status } : flow))
    }))
  }

  function moveFlow(flowId: string, direction: 'up' | 'down') {
    pushHistory()
    updateActiveMatrix((matrix) => {
      const index = matrix.flows.findIndex(flow => flow.id === flowId)
      if (index < 0) return matrix

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= matrix.flows.length) return matrix

      const flowsNext = [...matrix.flows]
      const moved = flowsNext[index]!
      flowsNext[index] = flowsNext[targetIndex]!
      flowsNext[targetIndex] = moved
      return { ...matrix, flows: flowsNext }
    })
  }

  function swapSourceDestination() {
    form.value = {
      ...form.value,
      source: form.value.destination,
      destination: form.value.source,
      nomSource: form.value.nomDestination,
      nomDestination: form.value.nomSource
    }
  }

  /* ------------------------------------------------------ Édition groupée */

  const isSelected = (flowId: string) => selectedFlowIds.value.includes(flowId)

  function toggleFlowSelection(flowId: string, checked: boolean) {
    if (checked) {
      if (!isSelected(flowId)) selectedFlowIds.value = [...selectedFlowIds.value, flowId]
      toolboxTab.value = 'bulk'
    } else {
      selectedFlowIds.value = selectedFlowIds.value.filter(id => id !== flowId)
    }
  }

  function toggleAllSelection(checked: boolean) {
    if (checked) {
      selectedFlowIds.value = displayedFlows.value.map(flow => flow.id)
      toolboxTab.value = 'bulk'
    } else {
      selectedFlowIds.value = []
    }
  }

  function applyBulkEdit() {
    if (!selectedFlowIds.value.length) return
    pushHistory()

    const field = bulkField.value
    const value = bulkValue.value
    const count = selectedFlowIds.value.length

    updateActiveMatrix(matrix => ({
      ...matrix,
      flows: matrix.flows.map((flow) => {
        if (!isSelected(flow.id)) return flow
        if (field === 'action') return { ...flow, action: value as FlowAction }
        if (field === 'status') return { ...flow, status: value as FlowStatus }
        if (field === 'sectionId') return { ...flow, sectionId: value || null }
        return { ...flow, [field]: value }
      })
    }))

    selectedFlowIds.value = []
    toast.add({ title: `${count} règle(s) modifiée(s)`, color: 'success' })
  }

  function bulkSwapSrcDst() {
    if (!selectedFlowIds.value.length) return
    pushHistory()
    updateActiveMatrix(matrix => ({
      ...matrix,
      flows: matrix.flows.map((flow) => {
        if (!isSelected(flow.id)) return flow
        return {
          ...flow,
          source: flow.destination,
          destination: flow.source,
          nomSource: flow.nomDestination,
          nomDestination: flow.nomSource
        }
      })
    }))
  }

  /* ------------------------------------------------------------ Sections */

  function addSection(name: string) {
    if (!normalize(name)) return
    updateActiveMatrix((matrix) => {
      const exists = matrix.sections.some(
        section => section.name.toLowerCase() === normalize(name).toLowerCase()
      )
      if (exists) return matrix
      return { ...matrix, sections: [...matrix.sections, createSection(name, matrix.sections.length)] }
    })
  }

  function deleteSection(sectionId: string) {
    updateActiveMatrix(matrix => ({
      ...matrix,
      sections: matrix.sections.filter(section => section.id !== sectionId),
      flows: matrix.flows.map(flow =>
        flow.sectionId === sectionId ? { ...flow, sectionId: null } : flow
      )
    }))
    if (form.value.sectionId === sectionId) form.value = { ...form.value, sectionId: '' }
  }

  const sectionOf = (flow: Flow): Section | undefined =>
    sections.value.find(section => section.id === flow.sectionId)

  /* ------------------------------------------------------- Objets réseau */

  function addAddressObject(draft: { name: string, value: string, comment: string }): boolean {
    const name = normalize(draft.name).toUpperCase()
    const value = normalize(draft.value)
    if (!name || !value) return false

    let added = false
    updateActiveMatrix((matrix) => {
      if (matrix.objects.addresses.some(a => a.name.toLowerCase() === name.toLowerCase())) return matrix
      added = true
      return {
        ...matrix,
        objects: {
          ...matrix.objects,
          addresses: [
            ...matrix.objects.addresses,
            { id: genId(), name, value, comment: normalize(draft.comment) }
          ]
        }
      }
    })
    return added
  }

  function removeAddressObject(addressId: string) {
    updateActiveMatrix(matrix => ({
      ...matrix,
      objects: {
        ...matrix.objects,
        addresses: matrix.objects.addresses.filter(address => address.id !== addressId)
      }
    }))
  }

  function addServiceObject(
    draft: { name: string, protocol: string, port: string, comment: string }
  ): boolean {
    const name = normalize(draft.name).toUpperCase()
    const protocol = normalizeProtocol(draft.protocol)
    const port = normalize(draft.port)
    if (!name || (!protocol && !port)) return false

    let added = false
    updateActiveMatrix((matrix) => {
      if (matrix.objects.services.some(s => s.name.toLowerCase() === name.toLowerCase())) return matrix
      added = true
      return {
        ...matrix,
        objects: {
          ...matrix.objects,
          services: [
            ...matrix.objects.services,
            { id: genId(), name, protocol, port, comment: normalize(draft.comment) }
          ]
        }
      }
    })
    return added
  }

  function removeServiceObject(serviceId: string) {
    updateActiveMatrix(matrix => ({
      ...matrix,
      objects: {
        ...matrix.objects,
        services: matrix.objects.services.filter(service => service.id !== serviceId)
      }
    }))
  }

  /* ------------------------------------------------------------ Matrices */

  function addMatrix() {
    const matrix = createMatrix(`Matrice ${matrices.value.length + 1}`)
    matrices.value = [...matrices.value, matrix]
    activeMatrixId.value = matrix.id
    resetForm()
  }

  function deleteMatrix(matrixId: string) {
    if (matrices.value.length === 1) return
    const nextMatrices = matrices.value.filter(matrix => matrix.id !== matrixId)
    matrices.value = nextMatrices
    if (activeMatrixId.value === matrixId) {
      activeMatrixId.value = nextMatrices[0]!.id
      resetForm()
    }
  }

  function renameMatrix(matrixId: string, name: string) {
    if (!normalize(name)) return
    matrices.value = matrices.value.map(matrix =>
      matrix.id === matrixId
        ? { ...matrix, name: normalize(name), updatedAt: new Date().toISOString() }
        : matrix
    )
  }

  function selectMatrix(matrixId: string) {
    activeMatrixId.value = matrixId
  }

  function resetWorkspace() {
    const matrix = createMatrix()
    matrices.value = [matrix]
    activeMatrixId.value = matrix.id
    resetForm()
    flowsHistory.value = []
    selectedFlowIds.value = []
    exportFeedback.value = 'Espace de travail réinitialisé.'
  }

  function generateBulkAd() {
    pushHistory()
    const adFlows = buildBulkAdFlows()
    updateActiveMatrix(matrix => ({ ...matrix, flows: [...matrix.flows, ...adFlows] }))
    toast.add({ title: 'Pack Bulk AD généré', description: '3 règles ajoutées.', color: 'success' })
  }

  /* ------------------------------------------------------ Import / Export */

  function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const slug = () =>
    (activeMatrix.value?.name || 'flow-matrix').replace(/\s+/g, '-').toLowerCase()

  function exportJson() {
    if (!activeMatrix.value) return
    downloadText(
      `${slug()}-flow-matrix.json`,
      JSON.stringify(activeMatrix.value, null, 2),
      'application/json;charset=utf-8'
    )
    exportFeedback.value = 'Export JSON téléchargé.'
  }

  function exportCsv() {
    downloadText(`${slug()}.csv`, buildCsv(flows.value, sections.value), 'text/csv;charset=utf-8')
    exportFeedback.value = 'Export CSV téléchargé.'
  }

  async function importJson(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as
        | Record<string, unknown>
        | Record<string, unknown>[]

      const importedMatrix = !Array.isArray(parsed) && Array.isArray(parsed.flows) ? parsed : null
      const rawFlows = Array.isArray(parsed)
        ? parsed
        : (importedMatrix?.flows as Record<string, unknown>[] | undefined) ?? []
      const rawSections =
        importedMatrix && Array.isArray(importedMatrix.sections)
          ? (importedMatrix.sections as Record<string, unknown>[])
          : []

      let importedCount = 0
      pushHistory()

      updateActiveMatrix((matrix) => {
        const nextSections = [...matrix.sections]
        const importedSectionIdMap = new Map<string, string>()

        for (const rawSection of rawSections) {
          const name = normalize(rawSection.name)
          if (!name) continue
          let section = nextSections.find(item => item.name.toLowerCase() === name.toLowerCase())
          if (!section) {
            section = createSection(name, nextSections.length)
            nextSections.push(section)
          }
          const rawId = normalize(rawSection.id)
          if (rawId) importedSectionIdMap.set(rawId, section.id)
        }

        const resolveSectionId = (rawSectionId: unknown, rawSectionName: unknown) => {
          const id = normalize(rawSectionId)
          if (id && importedSectionIdMap.has(id)) return importedSectionIdMap.get(id) ?? null

          const name = normalize(rawSectionName)
          if (!name) return null
          const section = nextSections.find(item => item.name.toLowerCase() === name.toLowerCase())
          if (section) return section.id

          const created = createSection(name, nextSections.length)
          nextSections.push(created)
          return created.id
        }

        const importedFlows = rawFlows
          .map(rawFlow => normalizeImportedFlow(rawFlow, resolveSectionId))
          .filter((flow): flow is Flow => flow !== null)

        importedCount = importedFlows.length

        return { ...matrix, sections: nextSections, flows: [...matrix.flows, ...importedFlows] }
      })

      exportFeedback.value = `${importedCount} flux importé(s).`
      toast.add({
        title: 'Import terminé',
        description: `${importedCount} flux ajouté(s) à la matrice.`,
        color: importedCount ? 'success' : 'warning'
      })
    } catch {
      toast.add({ title: 'Import impossible', description: 'Fichier JSON invalide.', color: 'error' })
    }
  }

  /* ---------------------------------------------------------- Persistance */

  async function load(force = false) {
    if (loaded.value && !force) return
    try {
      const document = await doc.load(scopeRef.value)
      const workspace = document.data
        ? normalizeWorkspace(document.data)
        : { matrices: [createMatrix()], activeMatrixId: '' }

      matrices.value = workspace.matrices
      activeMatrixId.value = workspace.activeMatrixId || workspace.matrices[0]!.id
      lastSavedAt.value = document.updatedAt
    } catch {
      toast.add({ title: 'Espace de travail indisponible', color: 'warning' })
    } finally {
      loaded.value = true
    }
  }

  /** Bascule entre brouillon personnel et matrice partagée d'une équipe. */
  async function switchScope(next: 'user' | 'team', nextTeamId?: number) {
    scope.value = next
    teamId.value = next === 'team' ? (nextTeamId ?? null) : null
    loaded.value = false
    flowsHistory.value = []
    selectedFlowIds.value = []
    await load(true)
  }

  async function save(silent = true) {
    saving.value = true
    try {
      const ok = await doc.save(scopeRef.value, {
        matrices: matrices.value,
        activeMatrixId: activeMatrixId.value
      })

      if (!ok) {
        toast.add({
          title: 'Modifié par un coéquipier',
          description: 'Comparez les versions avant d\'enregistrer.',
          color: 'warning'
        })
        return
      }

      lastSavedAt.value = doc.updatedAt.value
      if (!silent) {
        exportFeedback.value = 'Espace de travail enregistré.'
        toast.add({ title: 'Espace de travail enregistré', color: 'success' })
      }
    } catch {
      if (!silent) toast.add({ title: 'Sauvegarde impossible', color: 'error' })
    } finally {
      saving.value = false
    }
  }

  /** Reprend la version serveur après un conflit. */
  function acceptRemote() {
    const remote = doc.resolveWithRemote()
    if (!remote) return
    const workspace = normalizeWorkspace(remote)
    matrices.value = workspace.matrices
    activeMatrixId.value = workspace.activeMatrixId
    toast.add({ title: 'Version de l\'équipe rechargée', color: 'success' })
  }

  /** Impose la version locale par-dessus celle du serveur. */
  async function overwriteRemote() {
    doc.forceLocal()
    await save(false)
  }

  return {
    // état
    matrices, activeMatrixId, activeMatrix, loaded, lastSavedAt, saving,
    form, editingFlowId, tableQuery, diagramQuery, diagramStatus, diagramAction,
    selectedRelationKey, toolboxTab, selectedFlowIds, bulkField, bulkValue,
    flowsHistory, exportFeedback,
    // dérivés
    flows, sections, objects, addressOptions, serviceOptions, conflictKeys,
    stats, displayedFlows, relationGroups, selectedRelation, diagramGraph,
    juniperConfig, saveStatusLabel, protocolIsValid, canSubmit,
    // helpers
    hasConflict, isSelected, sectionOf,
    // actions
    undo, resetForm, submitFlow, editFlow, duplicateFlow, deleteFlow,
    updateFlowStatus, moveFlow, swapSourceDestination, toggleFlowSelection,
    toggleAllSelection, applyBulkEdit, bulkSwapSrcDst, addSection, deleteSection,
    addAddressObject, removeAddressObject, addServiceObject, removeServiceObject,
    addMatrix, deleteMatrix, renameMatrix, selectMatrix, resetWorkspace,
    generateBulkAd, exportJson, exportCsv, importJson, load, save,
    // collaboration
    scope, teamId, switchScope, conflict: doc.conflict, savedLabel: doc.savedLabel,
    updatedBy: doc.updatedBy, acceptRemote, overwriteRemote
  }
}
