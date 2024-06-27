const dmxArray = new Uint8Array(512);
let startIndex = 0;
let faderCount = 8;
let effectType = 'off';
let effectBPM = 120;
let effectIntensity = 50;
let effectMin = 0;
let effectMax = 255;
let effectTime = 0;
let effectGroup = new Set();
let lastFrameTime = 0;

function createFaderElement(index) {
    const container = document.createElement('div');
    container.className = 'fader-container';
    container.innerHTML = `
        <select class="fader-type-select">
            <option value="8bit">8-bit</option>
            <option value="16bit">16-bit</option>
            <option value="color">Color Mixer</option>
        </select>
        <div class="fader-type">8-bit</div>
        <div class="fader-index">${index + 1}</div>
        <div class="fader"><div class="knob"></div></div>
        <button class="max-button">Max</button>
        <div class="fader-value">0</div>
        <div class="color-mixer" style="display: none;"></div>
    `;
    return container;
}

function updateFaders() {
    const console = document.getElementById('faderConsole');
    console.innerHTML = '';
    for (let i = 0; i < faderCount; i++) {
        if (startIndex + i < 512) {
            const faderElement = createFaderElement(startIndex + i);
            console.appendChild(faderElement);
            setupFader(faderElement, startIndex + i);
        }
    }
}

function setupFader(faderContainer, dmxIndex) {
    const fader = faderContainer.querySelector('.fader');
    const knob = fader.querySelector('.knob');
    const valueDisplay = faderContainer.querySelector('.fader-value');
    const indexDisplay = faderContainer.querySelector('.fader-index');
    const typeDisplay = faderContainer.querySelector('.fader-type');
    const typeSelect = faderContainer.querySelector('.fader-type-select');
    const colorMixer = faderContainer.querySelector('.color-mixer');
    let isDragging = false;

    function updateValue(position) {
        let value;
        const faderType = typeSelect.value;
        if (faderType === '16bit') {
            value = Math.round((position / 180) * 65535);
            dmxArray[dmxIndex] = (value >> 8) & 0xFF;  // High byte
            dmxArray[dmxIndex + 1] = value & 0xFF;     // Low byte
            valueDisplay.textContent = value;
        } else if (faderType === 'color') {
            value = Math.round((position / 180) * 255);
            dmxArray[dmxIndex] = value;
            dmxArray[dmxIndex + 1] = value;
            dmxArray[dmxIndex + 2] = value;
            valueDisplay.textContent = `${value}, ${value}, ${value}`;
            colorMixer.style.backgroundColor = `rgb(${value}, ${value}, ${value})`;
        } else {
            value = Math.round((position / 180) * 255);
            dmxArray[dmxIndex] = value;
            valueDisplay.textContent = value;
        }
    }

    function moveKnobTo(position) {
        position = Math.max(0, Math.min(position, 180));
        knob.style.bottom = position + 'px';
        updateValue(position);
    }

    fader.addEventListener('mousedown', (e) => {
        if (e.target === fader) {
            const rect = fader.getBoundingClientRect();
            const newY = e.clientY - rect.top;
            moveKnobTo(200 - newY - 10);
        } else if (e.target === knob) {
            isDragging = true;
            document.addEventListener('mousemove', moveKnob);
            document.addEventListener('mouseup', stopDragging);
        }
    });

    function moveKnob(e) {
        if (isDragging) {
            const rect = fader.getBoundingClientRect();
            const newY = e.clientY - rect.top;
            moveKnobTo(200 - newY - 10);
        }
    }

    function stopDragging() {
        isDragging = false;
        document.removeEventListener('mousemove', moveKnob);
        document.removeEventListener('mouseup', stopDragging);
    }

    faderContainer.querySelector('.max-button').addEventListener('click', () => {
        moveKnobTo(180);
    });

    typeSelect.addEventListener('change', function() {
        const newType = this.value;
        typeDisplay.textContent = newType === '8bit' ? '8-bit' : newType === '16bit' ? '16-bit' : 'Color Mixer';
        fader.className = 'fader ' + newType;
        colorMixer.style.display = newType === 'color' ? 'block' : 'none';
        if (newType === 'color') {
            indexDisplay.textContent = `${dmxIndex + 1}-${dmxIndex + 3}`;
        } else {
            indexDisplay.textContent = newType === '16bit' ? `${dmxIndex + 1}-${dmxIndex + 2}` : (dmxIndex + 1).toString();
        }
        moveKnobTo(parseFloat(knob.style.bottom) || 0);
    });

    moveKnobTo(0);  // Initialize fader position
}

function applyEffect(currentTime) {
    if (effectType === 'off') {
        requestAnimationFrame(applyEffect);
        return;
    }

    if (lastFrameTime === 0) {
        lastFrameTime = currentTime;
    }

    const deltaTime = (currentTime - lastFrameTime) / 1000; // Convert to seconds
    lastFrameTime = currentTime;

    // Calculate phase based on BPM
    const beatsPerSecond = effectBPM / 60;
    effectTime += deltaTime * beatsPerSecond;

    const consoleElement = document.getElementById('faderConsole');
    const faders = consoleElement.querySelectorAll('.fader');

    faders.forEach((fader, index) => {
        const dmxIndex = startIndex + index;
        if (effectGroup.has(dmxIndex + 1)) {  // +1 because DMX channels are 1-indexed
            const knob = fader.querySelector('.knob');
            let normalizedValue;

            switch (effectType) {
                case 'sine':
                    const sinValue = Math.sin(effectTime * 2 * Math.PI + index * 0.5);
                    normalizedValue = (sinValue + 1) / 2;  // Normalize to 0-1 range
                    break;
                case 'linear':
                    normalizedValue = (effectTime + index * 0.1) % 1;  // Sawtooth wave
                    break;
                case 'zigzag':
                    const zigzagValue = ((effectTime + index * 0.1) % 1) * 2;
                    normalizedValue = zigzagValue > 1 ? 2 - zigzagValue : zigzagValue;
                    break;
            }

            const newPosition = normalizedValue * 180;
            knob.style.bottom = newPosition + 'px';
            
            // Update the value display
            const container = fader.closest('.fader-container');
            const valueDisplay = container.querySelector('.fader-value');
            const typeSelect = container.querySelector('.fader-type-select');
            const faderType = typeSelect.value;
            
            if (faderType === '16bit') {
                const value = Math.round(normalizedValue * 65535);
                valueDisplay.textContent = value;
                dmxArray[dmxIndex] = (value >> 8) & 0xFF;  // High byte
                dmxArray[dmxIndex + 1] = value & 0xFF;     // Low byte
            } else if (faderType === 'color') {
                const value = Math.round(normalizedValue * 255);
                valueDisplay.textContent = `${value}, ${value}, ${value}`;
                dmxArray[dmxIndex] = value;
                dmxArray[dmxIndex + 1] = value;
                dmxArray[dmxIndex + 2] = value;
                container.querySelector('.color-mixer').style.backgroundColor = `rgb(${value}, ${value}, ${value})`;
            } else {
                const value = Math.round(normalizedValue * 255);
                valueDisplay.textContent = value;
                dmxArray[dmxIndex] = value;
            }
        }
    });

    requestAnimationFrame(applyEffect);
}

function parseChannels(input) {
    const channels = new Set();
    const parts = input.split(',');
    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            for (let i = start; i <= end; i++) {
                channels.add(i);
            }
        } else {
            channels.add(Number(part));
        }
    }
    return channels;
}

document.getElementById('scrollLeft').addEventListener('click', () => {
    if (startIndex > 0) {
        startIndex--;
        updateFaders();
    }
});

document.getElementById('scrollRight').addEventListener('click', () => {
    if (startIndex < 512 - faderCount) {
        startIndex++;
        updateFaders();
    }
});

document.getElementById('faderCount').addEventListener('input', function() {
    const newFaderCount = parseInt(this.value);
    if (newFaderCount >= 1 && newFaderCount <= 512) {
        faderCount = newFaderCount;
        startIndex = Math.min(startIndex, 512 - faderCount);
        updateFaders();
    }
});

document.getElementById('effectToggle').addEventListener('change', function() {
    effectType = this.value;
    if (effectType !== 'off') {
        lastFrameTime = 0;
        requestAnimationFrame(applyEffect);
    }
});

document.getElementById('effectBPM').addEventListener('input', function() {
    effectBPM = parseInt(this.value);
});

document.getElementById('effectIntensity').addEventListener('input', function() {
    effectIntensity = parseInt(this.value);
});

document.getElementById('effectMin').addEventListener('input', function() {
    effectMin = parseInt(this.value);
    effectMax = Math.max(effectMin, effectMax);
    document.getElementById('effectMax').value = effectMax;
});

document.getElementById('effectMax').addEventListener('input', function() {
    effectMax = parseInt(this.value);
    effectMin = Math.min(effectMin, effectMax);
    document.getElementById('effectMin').value = effectMin;
});

document.getElementById('updateGroup').addEventListener('click', function() {
    const input = document.getElementById('groupChannels').value;
    effectGroup = parseChannels(input);
});

// Initialize the console
updateFaders();
requestAnimationFrame(applyEffect);
