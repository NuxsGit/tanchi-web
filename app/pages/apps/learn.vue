<script setup lang="ts">
import {
  EMPTY_PROGRESS, LEARN_COURSES, TOTAL_CHAPTERS, XP_CHAPTER, XP_QUIZ,
  chapterKey, rankFor,
  type LearnCourse, type LearnProgress
} from '~~/shared/learn/courses'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'TanchiLearn — Tanchi Web' })

const toast = useToast()

/* ------------------------------------------------------------ Progression */

const store = useDocument<LearnProgress>('learn')
const progress = ref<LearnProgress>({ ...EMPTY_PROGRESS, done: [], quiz: [] })

const done = computed(() => new Set(progress.value.done))
const quizDone = computed(() => new Set(progress.value.quiz))

onMounted(async () => {
  try {
    const document = await store.load({ scope: 'user' })
    if (document.data) {
      progress.value = {
        done: document.data.done ?? [],
        quiz: document.data.quiz ?? [],
        xp: document.data.xp ?? 0
      }
    }
  } catch {
    // Progression indisponible : on apprend quand même, sans compteur.
  }
})

/** L'enregistrement est différé : inutile d'écrire à chaque clic de quiz. */
let saveTimer: ReturnType<typeof setTimeout> | null = null

async function flush() {
  try {
    if (await store.save({ scope: 'user' }, progress.value)) return

    // Conflit de révision : un autre onglet a écrit entre-temps. Une
    // progression n'est qu'un cumul, on fusionne plutôt que de désigner un
    // gagnant — sinon l'onglet perdant cesse silencieusement d'enregistrer.
    const remote = store.resolveWithRemote()
    if (!remote) return

    progress.value = {
      done: [...new Set([...(remote.done ?? []), ...progress.value.done])],
      quiz: [...new Set([...(remote.quiz ?? []), ...progress.value.quiz])],
      xp: Math.max(remote.xp ?? 0, progress.value.xp)
    }
    await store.save({ scope: 'user' }, progress.value)
  } catch {
    // Serveur injoignable : la progression reste en mémoire pour la session.
  }
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    flush()
  }, 600)
}

function award(points: number, label: string) {
  progress.value.xp += points
  toast.add({ title: label, description: `+${points} points`, icon: 'i-lucide-sparkles', color: 'success' })
}

const rank = computed(() => rankFor(progress.value.xp))
const globalRatio = computed(() => progress.value.done.length / TOTAL_CHAPTERS)

function courseDone(course: LearnCourse): number {
  return course.chapters.filter(chapter => done.value.has(chapterKey(course.id, chapter.id))).length
}

function courseRatio(course: LearnCourse): number {
  return courseDone(course) / course.chapters.length
}

function isCourseComplete(course: LearnCourse): boolean {
  return courseDone(course) === course.chapters.length
}

const finishedCourses = computed(() => LEARN_COURSES.filter(isCourseComplete).length)

/* ------------------------------------------------------------------ Pile */

const index = ref(0)
const current = computed(() => LEARN_COURSES[index.value]!)

/** Verrou de défilement : un cran de molette fait avancer d'un dossier, pas dix. */
let wheelLock = false

function go(delta: number) {
  const next = index.value + delta
  if (next < 0 || next > LEARN_COURSES.length - 1) return
  index.value = next
}

function onWheel(event: WheelEvent) {
  event.preventDefault()
  if (wheelLock || pending.value) return

  // Molette verticale classique ou défilement horizontal d'un pavé tactile.
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (Math.abs(delta) < 4) return

  wheelLock = true
  go(delta > 0 ? 1 : -1)
  setTimeout(() => { wheelLock = false }, 320)
}

/* Glissé à la souris ou au doigt, pour le même geste sans molette. */
const dragStart = ref<number | null>(null)
const dragOffset = ref(0)
/** Vrai dès que le geste dépasse quelques pixels : le clic final est alors ignoré. */
const dragged = ref(false)

/* Inclinaison suivant le curseur : la pile réagit avant même qu'on la touche. */
const tiltX = ref(0)
const tiltY = ref(0)

/* Un seul recalcul par image : sans ce garde-fou, chaque événement souris
   refait le style des huit dossiers, ce qui hache le glissé sur une machine
   modeste. La dernière abscisse brute est gardée à part, pour que le seuil
   de relâchement reste juste même si une image a été sautée. */
let moveFrame = 0
let lastX = 0

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  dragStart.value = event.clientX
  lastX = event.clientX
  dragOffset.value = 0
  dragged.value = false
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  lastX = event.clientX
  if (moveFrame) return

  const host = event.currentTarget as HTMLElement
  const clientX = event.clientX
  const clientY = event.clientY

  moveFrame = requestAnimationFrame(() => {
    moveFrame = 0
    const rect = host.getBoundingClientRect()

    if (dragStart.value !== null) {
      dragOffset.value = clientX - dragStart.value
      if (Math.abs(dragOffset.value) > 6) dragged.value = true
    }

    tiltX.value = (clientX - rect.left) / rect.width - 0.5
    tiltY.value = (clientY - rect.top) / rect.height - 0.5
  })
}

function onPointerUp() {
  if (dragStart.value === null) return

  // Au-delà de 70 px, le geste vaut un cran. On tranche sur la position brute :
  // celle de l'état réactif peut avoir une image de retard.
  const travel = lastX - dragStart.value
  if (Math.abs(travel) > 70) go(travel < 0 ? 1 : -1)

  dragStart.value = null
  dragOffset.value = 0

  // Le clic part juste après ce relâchement : on ne lève le drapeau qu'ensuite.
  setTimeout(() => { dragged.value = false }, 0)
}

function onPointerLeave() {
  onPointerUp()
  tiltX.value = 0
  tiltY.value = 0
}

/** Un glissé ne doit pas ouvrir le dossier sur lequel il s'achève. */
function onSlotClick(course: LearnCourse, position: number) {
  if (dragged.value) return
  if (position === index.value) openCourse(course)
  else index.value = position
}

const stageStyle = computed(() => ({ '--h': String(current.value.hue) } as Record<string, string>))

const stageTransform = computed(() => ({
  transform: `rotateY(${(tiltX.value * 9).toFixed(2)}deg) rotateX(${(-tiltY.value * 7).toFixed(2)}deg)`
}))

/** Position d'un dossier dans la pile, relative au dossier de tête. */
function slotStyle(position: number) {
  const offset = position - index.value
  const distance = Math.abs(offset)

  // Le glissé en cours décale la pile entière, pour que le geste se voie.
  const drag = dragStart.value !== null ? dragOffset.value * 0.35 : 0

  return {
    transform: [
      `translateX(calc(${offset * 56}% + ${drag}px))`,
      `translateZ(${-distance * 110}px)`,
      `rotateY(${offset * -24}deg)`,
      `scale(${Math.max(0.55, 1 - distance * 0.09)})`
    ].join(' '),
    opacity: distance > 3 ? 0 : 1 - distance * 0.2,
    zIndex: 100 - distance,
    pointerEvents: distance > 3 ? 'none' : 'auto',
    filter: distance ? `brightness(${1 - distance * 0.18}) saturate(${1 - distance * 0.18})` : 'none'
  } as Record<string, string | number>
}

/* ---------------------------------------------------------------- Lecture */

const open = ref<LearnCourse | null>(null)
/** Dossier en cours d'ouverture : le temps que la couverture se soulève. */
const pending = ref<LearnCourse | null>(null)
const chapterIndex = ref(0)
const celebrating = ref(false)
/** Réponse choisie par bloc de quiz, pour la fiche affichée. */
const answers = ref<Record<number, number>>({})

const chapter = computed(() => open.value?.chapters[chapterIndex.value] ?? null)

function enterCourse(course: LearnCourse) {
  open.value = course
  celebrating.value = false

  // On reprend là où la lecture s'était arrêtée.
  const first = course.chapters.findIndex(item => !done.value.has(chapterKey(course.id, item.id)))
  chapterIndex.value = first === -1 ? 0 : first
  answers.value = {}
}

let openTimer: ReturnType<typeof setTimeout> | null = null

/** L'ouverture attend que le dossier ait fini de s'ouvrir à l'écran. */
function openCourse(course: LearnCourse) {
  if (pending.value) return
  pending.value = course

  openTimer = setTimeout(() => {
    enterCourse(course)
    pending.value = null
    openTimer = null
  }, 420)
}

function closeCourse() {
  open.value = null
  celebrating.value = false
}

function goChapter(position: number) {
  if (!open.value) return
  if (position < 0 || position > open.value.chapters.length - 1) return
  chapterIndex.value = position
  celebrating.value = false
  answers.value = {}
}

/** Marque la fiche lue, crédite les points et enchaîne. */
function completeChapter() {
  if (!open.value || !chapter.value) return

  const key = chapterKey(open.value.id, chapter.value.id)
  if (!done.value.has(key)) {
    progress.value.done.push(key)
    award(XP_CHAPTER, 'Fiche terminée')
    persist()
  }

  if (chapterIndex.value < open.value.chapters.length - 1) goChapter(chapterIndex.value + 1)
  else celebrating.value = true
}

function answer(blockIndex: number, choice: number, correct: number, quizId: string) {
  if (answers.value[blockIndex] !== undefined) return
  answers.value[blockIndex] = choice

  if (choice === correct && !quizDone.value.has(quizId)) {
    progress.value.quiz.push(quizId)
    award(XP_QUIZ, 'Bonne réponse')
    persist()
  }
}

/** Dossier suivant à proposer une fois celui-ci bouclé. */
const nextCourse = computed(() => {
  if (!open.value) return null
  const position = LEARN_COURSES.findIndex(course => course.id === open.value!.id)
  return LEARN_COURSES.find((course, item) => item > position && !isCourseComplete(course))
    ?? LEARN_COURSES.find(course => !isCourseComplete(course))
    ?? null
})

function jumpTo(course: LearnCourse) {
  index.value = LEARN_COURSES.findIndex(item => item.id === course.id)
  enterCourse(course)
}

/* ------------------------------------------------------------- Raccourcis */

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

  // Un bouton ou un lien qui a le focus s'active déjà seul : sans cela,
  // Entrée déclencherait à la fois le clic natif et l'ouverture du dossier.
  const activatable = Boolean(target && /^(BUTTON|A)$/.test(target.tagName))

  if (open.value) {
    if (event.key === 'Escape') { closeCourse(); event.preventDefault() }
    if (event.key === 'ArrowRight') { goChapter(chapterIndex.value + 1); event.preventDefault() }
    if (event.key === 'ArrowLeft') { goChapter(chapterIndex.value - 1); event.preventDefault() }
    return
  }

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { go(1); event.preventDefault() }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { go(-1); event.preventDefault() }
  if ((event.key === 'Enter' || event.key === ' ') && !activatable) {
    openCourse(current.value)
    event.preventDefault()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)

  // Une fiche validée moins de 600 ms avant de quitter la page serait perdue.
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    flush()
  }
  if (openTimer) clearTimeout(openTimer)
  if (moveFrame) cancelAnimationFrame(moveFrame)
})

const toneStyle: Record<string, { icon: string, ring: string, text: string }> = {
  info: { icon: 'i-lucide-info', ring: 'border-l-info-500', text: 'text-info-500' },
  tip: { icon: 'i-lucide-lightbulb', ring: 'border-l-success-500', text: 'text-success-500' },
  warning: { icon: 'i-lucide-triangle-alert', ring: 'border-l-warning-500', text: 'text-warning-500' }
}
</script>

<template>
  <div class="space-y-4">
    <!-- =============================================== Vue « dossiers » -->
    <template v-if="!open">
      <!-- Scène : l'ambiance prend la couleur du dossier de tête -->
      <section class="stage" :style="stageStyle" :class="{ 'is-leaving': pending }">
        <div class="stage__aurora" />
        <div class="stage__floor" />
        <div class="stage__vignette" />

        <!-- Bandeau d'accueil -->
        <header class="stage__intro">
          <p class="stage__eyebrow reveal" style="--d: 40ms">
            <NuxtLink to="/apps" class="transition hover:text-ink">applications</NuxtLink>
            <span class="opacity-40">/</span>
            <span class="text-accent">learn</span>
          </p>

          <h1 class="stage__title reveal" style="--d: 110ms">
            La suite Tanchi,<br>
            <span class="stage__title-accent">dossier par dossier</span>
          </h1>

          <p class="stage__lead reveal" style="--d: 190ms">
            <strong class="font-semibold text-ink">TanchiLearn</strong> —
            {{ LEARN_COURSES.length }} formations, {{ TOTAL_CHAPTERS }} fiches, une par outil de la suite.
            Molette pour changer de dossier, clic pour l'ouvrir.
          </p>

          <div class="stage__stats reveal" style="--d: 260ms">
            <span class="stage__chip">
              <UIcon :name="rank.current.icon" class="size-3.5" />
              {{ rank.current.label }}
            </span>
            <span class="stage__stat">{{ progress.xp }} <em>pts</em></span>
            <span class="stage__stat">{{ progress.done.length }}/{{ TOTAL_CHAPTERS }} <em>fiches</em></span>
            <span class="stage__stat">{{ finishedCourses }}/{{ LEARN_COURSES.length }} <em>dossiers</em></span>
          </div>
        </header>

        <!-- La pile -->
        <div
          class="deck"
          @wheel="onWheel"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @pointerleave="onPointerLeave"
        >
          <div class="deck__stage" :style="stageTransform">
            <button
              v-for="(course, position) in LEARN_COURSES"
              :key="course.id"
              type="button"
              class="deck__slot"
              :style="slotStyle(position)"
              :aria-label="course.title"
              :tabindex="position === index ? 0 : -1"
              @click="onSlotClick(course, position)"
            >
              <span class="deck__enter" :style="{ '--d': `${320 + position * 70}ms` }">
                <LearnFolder
                  :course="course"
                  :ratio="courseRatio(course)"
                  :active="position === index"
                  :complete="isCourseComplete(course)"
                  :opening="pending?.id === course.id"
                />
              </span>
            </button>
          </div>

          <button
            type="button"
            class="deck__arrow deck__arrow--left"
            :disabled="index === 0"
            aria-label="Dossier précédent"
            @click.stop="go(-1)"
          >
            <UIcon name="i-lucide-chevron-left" class="size-5" />
          </button>

          <button
            type="button"
            class="deck__arrow deck__arrow--right"
            :disabled="index === LEARN_COURSES.length - 1"
            aria-label="Dossier suivant"
            @click.stop="go(1)"
          >
            <UIcon name="i-lucide-chevron-right" class="size-5" />
          </button>

          <!-- Indice de geste, il s'efface dès qu'on a compris -->
          <p class="deck__hint" :class="{ 'is-hidden': index > 0 }">
            <UIcon name="i-lucide-mouse" class="size-3.5" />
            faites tourner la molette
          </p>
        </div>

        <!-- Pastilles -->
        <div class="stage__dots">
          <button
            v-for="(course, position) in LEARN_COURSES"
            :key="course.id"
            type="button"
            class="stage__dot"
            :class="{ 'is-on': position === index }"
            :aria-label="course.title"
            @click="index = position"
          />
        </div>
      </section>

      <!-- Fiche descriptive du dossier de tête -->
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div :key="current.id" class="panel rounded-xl border border-line bg-surface p-4">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-base font-semibold text-ink">{{ current.title }}</h2>
            <UBadge :label="current.level" color="neutral" variant="subtle" size="sm" />
            <UBadge
              v-if="isCourseComplete(current)"
              label="Bouclé"
              color="success"
              variant="subtle"
              size="sm"
              icon="i-lucide-check"
            />
          </div>

          <p class="mt-1 text-sm text-ink-muted">{{ current.subtitle }}</p>

          <!-- Sommaire du dossier, pour donner envie d'entrer -->
          <ul class="mt-3 grid gap-1 sm:grid-cols-2">
            <li
              v-for="(item, position) in current.chapters"
              :key="item.id"
              class="flex items-center gap-2 text-xs"
              :style="{ '--d': `${position * 45}ms` }"
            >
              <UIcon
                :name="done.has(chapterKey(current.id, item.id)) ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'"
                class="size-3.5 shrink-0"
                :class="done.has(chapterKey(current.id, item.id)) ? 'text-success-500' : 'text-ink-dim'"
              />
              <span class="min-w-0 truncate text-ink-muted">{{ item.title }}</span>
            </li>
          </ul>

          <div class="mt-4 flex flex-wrap gap-2">
            <UButton
              icon="i-lucide-book-open"
              color="primary"
              :label="courseDone(current) ? 'Reprendre le dossier' : 'Ouvrir le dossier'"
              @click="openCourse(current)"
            />
            <UButton
              v-if="current.to"
              :to="current.to"
              icon="i-lucide-arrow-up-right"
              trailing
              color="neutral"
              variant="outline"
              label="Voir l'application"
            />
          </div>
        </div>

        <!-- Rang et avancement -->
        <div class="rounded-xl border border-line bg-surface p-4">
          <p class="flex items-center gap-1.5 text-sm font-medium text-ink">
            <UIcon :name="rank.current.icon" class="size-4 text-accent" />
            {{ rank.current.label }}
          </p>

          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
            <div
              class="h-full rounded-full bg-accent transition-[width] duration-700"
              :style="{ width: `${Math.round(rank.ratio * 100)}%` }"
            />
          </div>

          <p class="mt-1.5 font-mono text-[11px] text-ink-dim">
            {{ progress.xp }} pts
            <span v-if="rank.next">· {{ rank.next.min - progress.xp }} pour {{ rank.next.label }}</span>
            <span v-else>· palier maximal</span>
          </p>

          <div class="mt-3 border-t border-line pt-3">
            <p class="font-mono text-[11px] uppercase tracking-wider text-ink-dim">Avancement</p>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
              <div
                class="h-full rounded-full bg-accent/60 transition-[width] duration-700"
                :style="{ width: `${Math.round(globalRatio * 100)}%` }"
              />
            </div>
            <p class="mt-1.5 font-mono text-[11px] text-ink-dim">
              {{ progress.done.length }}/{{ TOTAL_CHAPTERS }} fiches lues
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- ================================================ Vue « lecture » -->
    <div v-else class="reader-shell rounded-xl border border-line bg-surface" :style="{ '--h': String(open.hue) }">
      <!-- Bandeau teinté du dossier -->
      <div class="reader-head">
        <div class="reader-head__tint" />

        <div class="relative flex flex-wrap items-center gap-2 px-4 py-2.5">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            size="xs"
            label="Les dossiers"
            @click="closeCourse"
          />

          <span class="h-4 w-px bg-line" />

          <span class="flex items-center gap-2 text-sm font-medium text-ink">
            <span class="reader-head__icon">
              <UIcon :name="open.icon" class="size-4" />
            </span>
            {{ open.title }}
          </span>

          <span class="ml-auto font-mono text-[11px] text-ink-dim">
            fiche {{ chapterIndex + 1 }}/{{ open.chapters.length }}
          </span>
        </div>

        <div class="h-0.5 bg-raised">
          <div
            class="reader-head__bar"
            :style="{ width: `${Math.round(courseRatio(open) * 100)}%` }"
          />
        </div>
      </div>

      <div class="grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <!-- Sommaire -->
        <nav class="border-b border-line p-2 lg:border-b-0 lg:border-r">
          <button
            v-for="(item, position) in open.chapters"
            :key="item.id"
            type="button"
            class="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition"
            :class="position === chapterIndex && !celebrating ? 'bg-accent-soft' : 'hover:bg-raised'"
            @click="goChapter(position)"
          >
            <span
              class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px]"
              :class="done.has(chapterKey(open.id, item.id))
                ? 'border-success-500 bg-success-500 text-white'
                : 'border-line text-ink-dim'"
            >
              <UIcon v-if="done.has(chapterKey(open.id, item.id))" name="i-lucide-check" class="size-2.5" />
              <template v-else>{{ position + 1 }}</template>
            </span>

            <span class="min-w-0 flex-1">
              <span
                class="block text-xs leading-snug"
                :class="position === chapterIndex && !celebrating ? 'font-medium text-accent' : 'text-ink-muted'"
              >{{ item.title }}</span>
              <span class="mt-0.5 block font-mono text-[10px] text-ink-dim">{{ item.minutes }} min</span>
            </span>
          </button>
        </nav>

        <!-- ------------------------------------------- Écran de fin -->
        <div v-if="celebrating" class="finish">
          <div class="finish__ring">
            <UIcon name="i-lucide-check" class="size-8" />
          </div>

          <h2 class="mt-4 text-xl font-semibold tracking-tight text-ink">{{ open.title }} : dossier bouclé</h2>
          <p class="mt-1 text-sm text-ink-muted">
            {{ open.chapters.length }} fiches lues.
            <span v-if="finishedCourses < LEARN_COURSES.length">
              Il reste {{ LEARN_COURSES.length - finishedCourses }} dossier(s) à ouvrir.
            </span>
            <span v-else>Vous avez fait le tour de la suite.</span>
          </p>

          <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
            <UButton
              v-if="open.to"
              :to="open.to"
              icon="i-lucide-arrow-up-right"
              trailing
              color="primary"
              size="lg"
              :label="`Ouvrir ${open.title}`"
            />
            <UButton
              v-if="nextCourse"
              icon="i-lucide-folder-open"
              color="neutral"
              variant="outline"
              size="lg"
              :label="`Dossier suivant : ${nextCourse.title}`"
              @click="jumpTo(nextCourse)"
            />
            <UButton
              icon="i-lucide-layout-grid"
              color="neutral"
              variant="ghost"
              size="lg"
              label="Revenir à la pile"
              @click="closeCourse"
            />
          </div>
        </div>

        <!-- ------------------------------------------------- Contenu -->
        <article v-else-if="chapter" :key="chapter.id" class="reader p-4 sm:p-6">
          <h2 class="text-xl font-semibold tracking-tight text-ink">{{ chapter.title }}</h2>

          <div class="mt-4 space-y-4">
            <template v-for="(block, position) in chapter.blocks" :key="position">
              <p
                v-if="block.kind === 'text'"
                class="block-in text-sm leading-relaxed text-ink-muted"
                :style="{ '--d': `${position * 55}ms` }"
              >
                {{ block.text }}
              </p>

              <div
                v-else-if="block.kind === 'steps'"
                class="block-in rounded-lg border border-line bg-canvas p-3.5"
                :style="{ '--d': `${position * 55}ms` }"
              >
                <p v-if="block.title" class="mb-2 text-xs font-medium uppercase tracking-wider text-ink-dim">
                  {{ block.title }}
                </p>
                <ol class="space-y-2">
                  <li
                    v-for="(step, stepIndex) in block.items"
                    :key="stepIndex"
                    class="flex gap-2.5 text-sm leading-relaxed text-ink-muted"
                  >
                    <span class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-accent-soft font-mono text-[10px] text-accent">
                      {{ stepIndex + 1 }}
                    </span>
                    {{ step }}
                  </li>
                </ol>
              </div>

              <div
                v-else-if="block.kind === 'keys'"
                class="block-in grid gap-1.5 sm:grid-cols-2"
                :style="{ '--d': `${position * 55}ms` }"
              >
                <div
                  v-for="(shortcut, keyIndex) in block.items"
                  :key="keyIndex"
                  class="flex items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-1.5"
                >
                  <span class="flex shrink-0 items-center gap-1">
                    <kbd
                      v-for="key in shortcut.keys"
                      :key="key"
                      class="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-ink"
                    >{{ key }}</kbd>
                  </span>
                  <span class="min-w-0 text-xs text-ink-muted">{{ shortcut.label }}</span>
                </div>
              </div>

              <div
                v-else-if="block.kind === 'note'"
                class="block-in flex items-start gap-2.5 rounded-md border border-line border-l-2 bg-canvas p-3"
                :class="toneStyle[block.tone]!.ring"
                :style="{ '--d': `${position * 55}ms` }"
              >
                <UIcon
                  :name="toneStyle[block.tone]!.icon"
                  class="mt-0.5 size-4 shrink-0"
                  :class="toneStyle[block.tone]!.text"
                />
                <p class="text-sm leading-relaxed text-ink-muted">{{ block.text }}</p>
              </div>

              <div
                v-else-if="block.kind === 'code'"
                class="block-in overflow-hidden rounded-lg border border-line"
                :style="{ '--d': `${position * 55}ms` }"
              >
                <p v-if="block.caption" class="border-b border-line bg-raised px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                  {{ block.caption }}
                </p>
                <pre class="overflow-x-auto bg-canvas p-3 font-mono text-[12px] leading-relaxed text-ink-muted">{{ block.code }}</pre>
              </div>

              <div
                v-else-if="block.kind === 'quiz'"
                class="block-in rounded-lg border border-accent/30 bg-accent-soft/40 p-3.5"
                :style="{ '--d': `${position * 55}ms` }"
              >
                <p class="flex items-start gap-2 text-sm font-medium text-ink">
                  <UIcon name="i-lucide-circle-help" class="mt-0.5 size-4 shrink-0 text-accent" />
                  {{ block.question }}
                </p>

                <div class="mt-3 space-y-1.5">
                  <button
                    v-for="(option, optionIndex) in block.options"
                    :key="optionIndex"
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition"
                    :class="answers[position] === undefined
                      ? 'border-line bg-canvas text-ink-muted hover:border-accent/60'
                      : optionIndex === block.answer
                        ? 'border-success-500/50 bg-success-500/10 text-ink'
                        : answers[position] === optionIndex
                          ? 'border-error-500/50 bg-error-500/10 text-ink'
                          : 'border-line bg-canvas text-ink-dim'"
                    :disabled="answers[position] !== undefined"
                    @click="answer(position, optionIndex, block.answer, chapterKey(open.id, `${chapter.id}-${position}`))"
                  >
                    <UIcon
                      v-if="answers[position] !== undefined && optionIndex === block.answer"
                      name="i-lucide-check"
                      class="size-4 shrink-0 text-success-500"
                    />
                    <UIcon
                      v-else-if="answers[position] === optionIndex"
                      name="i-lucide-x"
                      class="size-4 shrink-0 text-error-500"
                    />
                    <span v-else class="size-4 shrink-0 rounded-full border border-line" />
                    {{ option }}
                  </button>
                </div>

                <p
                  v-if="answers[position] !== undefined"
                  class="mt-2.5 border-t border-line pt-2.5 text-sm leading-relaxed text-ink-muted"
                >
                  {{ block.explain }}
                </p>
              </div>
            </template>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="ghost"
              size="sm"
              label="Précédente"
              :disabled="chapterIndex === 0"
              @click="goChapter(chapterIndex - 1)"
            />

            <span
              v-if="done.has(chapterKey(open.id, chapter.id))"
              class="flex items-center gap-1.5 font-mono text-[11px] text-success-500"
            >
              <UIcon name="i-lucide-check" class="size-3.5" />
              fiche lue
            </span>

            <UButton
              class="ml-auto"
              :icon="chapterIndex === open.chapters.length - 1 ? 'i-lucide-flag' : 'i-lucide-chevron-right'"
              trailing
              color="primary"
              size="sm"
              :label="chapterIndex === open.chapters.length - 1 ? 'Terminer le dossier' : 'Fiche suivante'"
              @click="completeChapter"
            />
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* La teinte est enregistrée pour pouvoir être interpolée : sans cela, le
   passage d'un dossier à l'autre change la couleur d'un coup sec. */
@property --h {
  syntax: '<number>';
  inherits: true;
  initial-value: 210;
}

/* ------------------------------------------------------------ La scène */

.stage {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid var(--t-line);
  background: var(--t-surface);
  transition: --h .7s ease, opacity .3s ease .12s, transform .3s ease .12s;
  isolation: isolate;
}

/* Le dossier s'ouvre : la scène s'efface pour laisser place à la lecture. */
.stage.is-leaving {
  opacity: 0;
  transform: scale(1.04);
}

/* Aurores : trois dégradés radiaux qui dérivent lentement. Aucun filtre de
   flou, la douceur vient des dégradés eux-mêmes — c'est bien moins coûteux. */
.stage__aurora {
  position: absolute;
  inset: -25%;
  pointer-events: none;
  background:
    radial-gradient(38% 44% at 22% 26%, hsl(var(--h) 85% 55% / 0.34), transparent 66%),
    radial-gradient(34% 40% at 80% 58%, hsl(calc(var(--h) + 45) 85% 55% / 0.26), transparent 66%),
    radial-gradient(48% 52% at 50% 104%, hsl(calc(var(--h) - 35) 80% 50% / 0.22), transparent 70%);
  animation: drift 26s ease-in-out infinite alternate;
}

@keyframes drift {
  from { transform: translate3d(-2%, -1%, 0) scale(1); }
  to { transform: translate3d(3%, 2%, 0) scale(1.09); }
}

/* Sol en perspective : la grille technique qui ancre la pile */
.stage__floor {
  position: absolute;
  left: -35%;
  right: -35%;
  bottom: -16%;
  height: 58%;
  pointer-events: none;
  background-image:
    repeating-linear-gradient(90deg, hsl(var(--h) 75% 62% / 0.22) 0 1px, transparent 1px 4.5rem),
    repeating-linear-gradient(0deg, hsl(var(--h) 75% 62% / 0.22) 0 1px, transparent 1px 4.5rem);
  transform: perspective(520px) rotateX(75deg);
  transform-origin: bottom center;
  -webkit-mask-image: linear-gradient(to top, #000 2%, transparent 72%);
  mask-image: linear-gradient(to top, #000 2%, transparent 72%);
}

.stage__vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(120% 90% at 50% 40%, transparent 45%, var(--t-canvas) 100%);
  opacity: 0.55;
}

/* ---------------------------------------------------------- Le bandeau */

.stage__intro {
  position: relative;
  z-index: 2;
  padding: 1.75rem 1.75rem 0;
}

.stage__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-mono, ui-monospace), monospace;
  font-size: 0.65rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--t-ink-dim);
}

.stage__title {
  margin-top: 0.75rem;
  font-size: clamp(1.6rem, 3.4vw, 2.4rem);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.025em;
  color: var(--t-ink);
}

.stage__title-accent {
  background: linear-gradient(100deg, hsl(var(--h) 80% 60%), hsl(calc(var(--h) + 50) 80% 62%));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.stage__lead {
  margin-top: 0.6rem;
  max-width: 34rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--t-ink-muted, var(--t-ink-dim));
}

.stage__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.25rem;
  margin-top: 1rem;
}

.stage__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid hsl(var(--h) 70% 55% / 0.4);
  background: hsl(var(--h) 70% 55% / 0.12);
  font-size: 0.7rem;
  color: var(--t-ink);
}

.stage__stat {
  font-family: var(--font-mono, ui-monospace), monospace;
  font-size: 0.8rem;
  color: var(--t-ink);
}

.stage__stat em {
  font-style: normal;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--t-ink-dim);
}

/* -------------------------------------------------------------- La pile */

.deck {
  position: relative;
  height: 21rem;
  z-index: 1;
  perspective: 1500px;
  perspective-origin: 50% 42%;
  touch-action: pan-y;
  user-select: none;
  cursor: grab;
}

.deck:active { cursor: grabbing; }

.deck__stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-style: preserve-3d;
  transition: transform .35s ease-out;
}

.deck__slot {
  position: absolute;
  transform-style: preserve-3d;
  transition:
    transform .55s cubic-bezier(.22, 1, .36, 1),
    opacity .4s ease,
    filter .4s ease;
  will-change: transform;
}

.deck__slot:focus-visible {
  outline: 2px solid hsl(var(--h) 80% 60%);
  outline-offset: 10px;
  border-radius: 1rem;
}

/* Entrée en scène, décalée d'un dossier à l'autre */
.deck__enter {
  display: block;
  animation: rise .7s cubic-bezier(.22, 1, .36, 1) both;
  animation-delay: var(--d, 0ms);
}

@keyframes rise {
  from { opacity: 0; transform: translateY(46px) scale(.9); }
  to { opacity: 1; transform: none; }
}

.deck__arrow {
  position: absolute;
  top: 50%;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  transform: translateY(-50%);
  border-radius: 999px;
  border: 1px solid var(--t-line);
  background: color-mix(in oklab, var(--t-raised) 80%, transparent);
  backdrop-filter: blur(6px);
  color: var(--t-ink-dim);
  transition: color .2s, border-color .2s, opacity .2s;
}

.deck__arrow:hover:not(:disabled) {
  color: var(--t-ink);
  border-color: hsl(var(--h) 75% 60%);
}

.deck__arrow:disabled { opacity: 0.2; cursor: default; }
.deck__arrow--left { left: 1rem; }
.deck__arrow--right { right: 1rem; }

.deck__hint {
  position: absolute;
  left: 50%;
  bottom: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transform: translateX(-50%);
  font-family: var(--font-mono, ui-monospace), monospace;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: var(--t-ink-dim);
  animation: pulse 2.6s ease-in-out infinite;
  transition: opacity .4s ease;
}

.deck__hint.is-hidden { opacity: 0; }

@keyframes pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.9; }
}

.stage__dots {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
  gap: 0.4rem;
  padding-bottom: 1.1rem;
}

.stage__dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 999px;
  background: var(--t-line);
  transition: all .35s cubic-bezier(.22, 1, .36, 1);
}

.stage__dot:hover { background: var(--t-ink-dim); }

.stage__dot.is-on {
  width: 1.4rem;
  background: hsl(var(--h) 80% 60%);
}

/* ------------------------------------------------------------ Panneaux */

.panel { animation: reveal .45s cubic-bezier(.22, 1, .36, 1) both; }

.reveal {
  animation: reveal .65s cubic-bezier(.22, 1, .36, 1) both;
  animation-delay: var(--d, 0ms);
}

@keyframes reveal {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: none; }
}

/* ------------------------------------------------------------- Lecture */

.reader-shell {
  overflow: hidden;
  animation: shell-in .45s cubic-bezier(.22, 1, .36, 1) both;
}

@keyframes shell-in {
  from { opacity: 0; transform: scale(.985) translateY(10px); }
  to { opacity: 1; transform: none; }
}

.reader-head {
  position: relative;
  border-bottom: 1px solid var(--t-line);
}

.reader-head__tint {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(100deg, hsl(var(--h) 80% 55% / 0.16), transparent 55%);
}

.reader-head__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 0.4rem;
  background: hsl(var(--h) 70% 50% / 0.18);
  color: hsl(var(--h) 80% 62%);
}

.reader-head__bar {
  height: 100%;
  background: linear-gradient(90deg, hsl(var(--h) 80% 55%), hsl(calc(var(--h) + 45) 80% 60%));
  transition: width .6s cubic-bezier(.22, 1, .36, 1);
}

.reader { animation: reveal .35s cubic-bezier(.22, 1, .36, 1) both; }

.block-in {
  animation: reveal .45s cubic-bezier(.22, 1, .36, 1) both;
  animation-delay: var(--d, 0ms);
}

/* ---------------------------------------------------------- Écran de fin */

.finish {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
  animation: reveal .5s cubic-bezier(.22, 1, .36, 1) both;
}

.finish__ring {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 999px;
  color: hsl(var(--h) 80% 62%);
  background: hsl(var(--h) 70% 50% / 0.14);
  box-shadow: 0 0 0 1px hsl(var(--h) 70% 55% / 0.35);
  animation: seal .6s cubic-bezier(.2, .9, .25, 1.35) both;
}

@keyframes seal {
  from { opacity: 0; transform: scale(.5) rotate(-25deg); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .stage__aurora,
  .deck__hint { animation: none; }
  .deck__slot,
  .deck__stage { transition: none; }
  .deck__enter,
  .reveal,
  .panel,
  .reader,
  .reader-shell,
  .block-in,
  .finish,
  .finish__ring { animation: none; }
}
</style>
