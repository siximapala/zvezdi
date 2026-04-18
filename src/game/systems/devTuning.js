const STORAGE_KEY = 'zvezdi.devTuning.v1';

export const DEFAULT_TUNING = {
  speedScale: 1.35,
  accelerationScale: 1.45,
  airControlScale: 1.2,
  jumpScale: 1.08,
  rampForceScale: 1.7,
  rampSpeedScale: 1.35,
  grappleSwingScale: 1.35,
  grappleSpeedScale: 1.25
};

const SLIDERS = [
  {
    key: 'speedScale',
    label: 'Скорость',
    min: 0.7,
    max: 2.2,
    step: 0.05
  },
  {
    key: 'accelerationScale',
    label: 'Разгон',
    min: 0.6,
    max: 2.4,
    step: 0.05
  },
  {
    key: 'airControlScale',
    label: 'Воздух',
    min: 0.5,
    max: 2,
    step: 0.05
  },
  {
    key: 'jumpScale',
    label: 'Прыжок',
    min: 0.75,
    max: 1.45,
    step: 0.05
  },
  {
    key: 'rampForceScale',
    label: 'Рампа: сила',
    min: 0.4,
    max: 3.5,
    step: 0.05
  },
  {
    key: 'rampSpeedScale',
    label: 'Рампа: скорость',
    min: 0.6,
    max: 2.6,
    step: 0.05
  },
  {
    key: 'grappleSwingScale',
    label: 'Лоза: сила',
    min: 0.6,
    max: 3.5,
    step: 0.05
  },
  {
    key: 'grappleSpeedScale',
    label: 'Лоза: скорость',
    min: 0.8,
    max: 2.6,
    step: 0.05
  }
];

export function createGameplayTuning() {
  return {
    ...DEFAULT_TUNING,
    ...readStoredTuning()
  };
}

export function isDevTuningEnabled() {
  const params = new URLSearchParams(window.location.search);
  return params.get('dev') === '1' || window.localStorage.getItem('zvezdi.devPanel') === '1';
}

export function createDevTuningPanel(scene) {
  removeDevTuningPanel();
  window.localStorage.setItem('zvezdi.devPanel', '1');

  const panel = document.createElement('section');
  panel.id = 'dev-tuning';
  panel.className = 'dev-tuning';
  panel.innerHTML = `
    <div class="dev-tuning__header">
      <strong>Dev tuning</strong>
      <button type="button" data-action="close" aria-label="Скрыть">×</button>
    </div>
    <p class="dev-tuning__hint">Крути на лету. Значения сохраняются в браузере.</p>
    <div class="dev-tuning__sliders"></div>
    <div class="dev-tuning__actions">
      <button type="button" data-action="reset">Сброс</button>
    </div>
  `;

  const slidersRoot = panel.querySelector('.dev-tuning__sliders');

  for (const slider of SLIDERS) {
    slidersRoot.append(createSlider(scene, slider));
  }

  panel.querySelector('[data-action="reset"]').addEventListener('click', () => {
    Object.assign(scene.gameplayTuning, DEFAULT_TUNING);
    writeStoredTuning(scene.gameplayTuning);

    for (const input of panel.querySelectorAll('input[type="range"]')) {
      const key = input.dataset.key;
      input.value = String(scene.gameplayTuning[key]);
      updateValueLabel(panel, key, scene.gameplayTuning[key]);
    }
  });

  panel.querySelector('[data-action="close"]').addEventListener('click', () => {
    window.localStorage.removeItem('zvezdi.devPanel');
    removeDevTuningPanel();
  });

  document.body.append(panel);
  return panel;
}

export function removeDevTuningPanel() {
  document.querySelector('#dev-tuning')?.remove();
}

function createSlider(scene, slider) {
  const row = document.createElement('label');
  row.className = 'dev-tuning__row';
  row.innerHTML = `
    <span>${slider.label}</span>
    <input type="range" min="${slider.min}" max="${slider.max}" step="${slider.step}" value="${scene.gameplayTuning[slider.key]}" data-key="${slider.key}" />
    <output data-value-for="${slider.key}">${formatValue(scene.gameplayTuning[slider.key])}</output>
  `;

  const input = row.querySelector('input');
  input.addEventListener('input', () => {
    scene.gameplayTuning[slider.key] = Number(input.value);
    updateValueLabel(row, slider.key, scene.gameplayTuning[slider.key]);
    writeStoredTuning(scene.gameplayTuning);
  });

  return row;
}

function updateValueLabel(root, key, value) {
  const output = root.querySelector(`[data-value-for="${key}"]`) ?? document.querySelector(`[data-value-for="${key}"]`);

  if (output) {
    output.textContent = formatValue(value);
  }
}

function formatValue(value) {
  return `${Number(value).toFixed(2)}x`;
}

function readStoredTuning() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    const tuning = {};

    for (const slider of SLIDERS) {
      const value = Number(parsed[slider.key]);

      if (Number.isFinite(value)) {
        tuning[slider.key] = value;
      }
    }

    return tuning;
  } catch {
    return {};
  }
}

function writeStoredTuning(tuning) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning));
}
