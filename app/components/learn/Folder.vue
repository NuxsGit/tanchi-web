<script setup lang="ts">
import type { LearnCourse } from '~~/shared/learn/courses'

const props = withDefaults(defineProps<{
  course: LearnCourse
  /** Part de fiches lues, entre 0 et 1. */
  ratio?: number
  /** Le dossier de tête s'entrouvre ; les autres restent fermés. */
  active?: boolean
  /** Toutes les fiches sont lues. */
  complete?: boolean
  /** Ouverture complète, le temps de la transition vers la lecture. */
  opening?: boolean
}>(), { ratio: 0, active: false, complete: false, opening: false })

/** Palette dérivée de la teinte du cours, pour rester lisible sur tout thème. */
const tint = computed(() => ({
  '--f-back': `hsl(${props.course.hue} 55% 30%)`,
  '--f-front': `hsl(${props.course.hue} 64% 47%)`,
  '--f-front-lo': `hsl(${props.course.hue} 58% 33%)`,
  '--f-edge': `hsl(${props.course.hue} 85% 68%)`,
  '--f-deep': `hsl(${props.course.hue} 60% 18%)`,
  '--f-glow': `hsl(${props.course.hue} 85% 55% / 0.4)`
} as Record<string, string>))

/** Une fiche par chapitre, plafonnée : au-delà la pile devient illisible. */
const sheets = computed(() => Math.min(4, props.course.chapters.length))

const percent = computed(() => Math.round(props.ratio * 100))
</script>

<template>
  <div
    class="folder"
    :class="{ 'is-active': active, 'is-opening': opening }"
    :style="tint"
  >
    <!-- Halo et ombre portée : ils donnent l'assise au dossier de tête -->
    <div class="folder__glow" />
    <div class="folder__shadow" />

    <!-- Languette et dos -->
    <div class="folder__tab">
      <span class="folder__tab-label">{{ course.level }}</span>
    </div>

    <div class="folder__back" />

    <!-- Fiches internes : elles remontent et s'éventent à l'ouverture -->
    <div
      v-for="n in sheets"
      :key="n"
      class="folder__sheet"
      :style="{ '--i': String(n), zIndex: String(10 + n) }"
    >
      <span class="folder__sheet-head" />
    </div>

    <!-- Rabat avant -->
    <div class="folder__front">
      <div class="folder__gloss" />

      <div class="folder__head">
        <span class="folder__icon">
          <UIcon :name="course.icon" class="size-6" />
        </span>

        <span v-if="complete" class="folder__seal">
          <UIcon name="i-lucide-check" class="size-3.5" />
        </span>
      </div>

      <p class="folder__name">{{ course.title }}</p>
      <p class="folder__sub">{{ course.chapters.length }} fiches · {{ percent }} %</p>

      <div class="folder__bar">
        <div class="folder__fill" :style="{ width: `${percent}%` }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.folder {
  position: relative;
  width: 18rem;
  height: 12.5rem;
  transform-style: preserve-3d;
}

/* Respiration lente du dossier de tête : le plan a l'air vivant sans bouger */
.folder.is-active { animation: float 5s ease-in-out infinite; }

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.folder__glow {
  position: absolute;
  inset: 15% 2% -18% 2%;
  border-radius: 50%;
  background: var(--f-glow);
  filter: blur(30px);
  opacity: 0;
  transition: opacity .6s ease;
}

.folder.is-active .folder__glow { opacity: 1; }

.folder__shadow {
  position: absolute;
  left: 12%;
  right: 12%;
  bottom: -1.4rem;
  height: 1.1rem;
  border-radius: 50%;
  background: radial-gradient(50% 50% at 50% 50%, rgb(0 0 0 / 0.55), transparent 70%);
  opacity: 0.5;
  transition: opacity .5s ease, transform .5s ease;
}

.folder.is-active .folder__shadow { opacity: 0.85; transform: scaleX(1.08); }

/* Languette : l'onglet du haut, décalé à gauche comme sur un vrai dossier */
.folder__tab {
  position: absolute;
  top: 0;
  left: 0;
  width: 46%;
  height: 1.7rem;
  padding: 0 0.75rem;
  display: flex;
  align-items: center;
  border-radius: 0.55rem 1rem 0 0;
  background: linear-gradient(180deg, var(--f-back), var(--f-deep));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.2);
}

.folder__tab-label {
  font-family: var(--font-mono, ui-monospace), monospace;
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.7);
  white-space: nowrap;
}

.folder__back {
  position: absolute;
  inset: 1.6rem 0 0 0;
  border-radius: 0.35rem 0.8rem 0.8rem 0.8rem;
  background: linear-gradient(160deg, var(--f-back), var(--f-deep));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.18),
    0 22px 40px -22px rgb(0 0 0 / 0.85);
}

/* Fiches : quelques lignes suggérées suffisent à faire lire « feuille » */
.folder__sheet {
  position: absolute;
  left: calc(7% + (var(--i) - 1) * 3.2%);
  right: calc(9% + (4 - var(--i)) * 1.6%);
  top: 2.3rem;
  height: 6.6rem;
  padding: 0.55rem 0.5rem;
  border-radius: 0.28rem;
  background:
    repeating-linear-gradient(180deg, transparent 0 0.34rem, rgb(30 41 59 / 0.1) 0.34rem 0.4rem),
    linear-gradient(180deg, #f8f9fa, #dde2e7);
  background-clip: content-box, border-box;
  box-shadow: 0 3px 8px -3px rgb(0 0 0 / 0.55);
  transform: translateY(0) rotate(0deg);
  transition: transform .6s cubic-bezier(.2, .9, .25, 1.15), opacity .4s ease;
}

.folder__sheet-head {
  display: block;
  width: 55%;
  height: 0.22rem;
  border-radius: 999px;
  background: var(--f-front);
  opacity: 0.65;
}

.folder.is-active .folder__sheet {
  transform:
    translateY(calc(var(--i) * -0.5rem - 0.6rem))
    rotate(calc((var(--i) - 2.5) * 1.4deg));
}

.folder.is-opening .folder__sheet {
  transform:
    translateY(calc(var(--i) * -1.6rem - 2rem))
    rotate(calc((var(--i) - 2.5) * 7deg))
    scale(1.04);
  opacity: 0;
}

/* Rabat avant : il pivote comme une couverture que l'on soulève */
.folder__front {
  position: absolute;
  inset: auto 0 0 0;
  height: 8.6rem;
  padding: 0.9rem 1rem;
  z-index: 20;
  overflow: hidden;
  border-radius: 0.8rem;
  background: linear-gradient(158deg, var(--f-front) 0%, var(--f-front-lo) 55%, var(--f-back) 100%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.28),
    inset 0 -1px 0 rgb(0 0 0 / 0.25),
    0 -3px 14px -6px rgb(0 0 0 / 0.6);
  transform-origin: bottom center;
  transform: rotateX(0deg);
  transition: transform .6s cubic-bezier(.2, .9, .25, 1.15);
}

.folder.is-active .folder__front { transform: rotateX(-18deg); }
.folder.is-opening .folder__front { transform: rotateX(-82deg); }

/* Reflet qui balaie la couverture, uniquement sur le dossier de tête */
.folder__gloss {
  position: absolute;
  top: -60%;
  left: -60%;
  width: 45%;
  height: 220%;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.22), transparent);
  transform: rotate(18deg) translateX(-40%);
  opacity: 0;
  pointer-events: none;
}

.folder.is-active .folder__gloss {
  opacity: 1;
  animation: sweep 4.5s ease-in-out 0.4s infinite;
}

@keyframes sweep {
  0%, 65% { transform: rotate(18deg) translateX(-40%); }
  100% { transform: rotate(18deg) translateX(560%); }
}

.folder__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.folder__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.6rem;
  background: rgb(0 0 0 / 0.25);
  color: #fff;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.25);
}

.folder__seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 999px;
  background: #fff;
  color: var(--f-deep);
  box-shadow: 0 2px 6px -2px rgb(0 0 0 / 0.6);
}

.folder__name {
  margin-top: 0.7rem;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.15;
  color: #fff;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
}

.folder__sub {
  margin-top: 0.2rem;
  font-family: var(--font-mono, ui-monospace), monospace;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  color: rgb(255 255 255 / 0.75);
}

.folder__bar {
  position: absolute;
  left: 1rem;
  right: 1rem;
  bottom: 0.85rem;
  height: 0.28rem;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.32);
  overflow: hidden;
}

.folder__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--f-edge), #fff);
  box-shadow: 0 0 8px var(--f-glow);
  transition: width .5s cubic-bezier(.22, 1, .36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .folder.is-active { animation: none; }
  .folder.is-active .folder__gloss { animation: none; opacity: 0; }
  .folder__sheet,
  .folder__front { transition: none; }
}
</style>
