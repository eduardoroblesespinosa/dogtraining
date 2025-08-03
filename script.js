document.addEventListener('DOMContentLoaded', () => {
    // --- Shared Audio Context ---
    let audioContext;

    function getAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.error('Web Audio API is not supported in this browser', e);
                alert('Tu navegador no soporta la API de Audio. La funcionalidad de audio no funcionará.');
                return null;
            }
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        return audioContext;
    }


    // --- Anti-Bark Tool ---
    const barkButton = document.getElementById('bark-button');
    const volumeSlider = document.getElementById('volume-slider');
    let antiBarkBuffer;
    let antiBarkGainNode;

    async function initAntiBark() {
        if (!getAudioContext() || antiBarkBuffer) return;

        try {
            const response = await fetch('anti_bark.mp3');
            const arrayBuffer = await response.arrayBuffer();
            antiBarkBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            antiBarkGainNode = audioContext.createGain();
            antiBarkGainNode.gain.value = volumeSlider.value;
            antiBarkGainNode.connect(audioContext.destination);
        } catch (e) {
            console.error('Error al inicializar el audio anti-ladrido:', e);
        }
    }

    function playAntiBarkSound() {
        if (!antiBarkBuffer || !antiBarkGainNode) {
            console.warn('Audio anti-ladrido no está listo. Inicializando...');
            initAntiBark().then(() => {
                if(antiBarkBuffer) playAntiBarkSoundInternal();
            });
            return;
        }
        if (getAudioContext().state === 'suspended') {
            getAudioContext().resume();
        }
        playAntiBarkSoundInternal();
    }
    
    function playAntiBarkSoundInternal() {
        const source = audioContext.createBufferSource();
        source.buffer = antiBarkBuffer;
        source.connect(antiBarkGainNode);
        source.start(0);
    }

    if(barkButton && volumeSlider) {
        barkButton.addEventListener('click', playAntiBarkSound);
        volumeSlider.addEventListener('input', () => {
            if (antiBarkGainNode) {
                antiBarkGainNode.gain.value = volumeSlider.value;
            }
        });
        initAntiBark(); // Pre-load the sound
    }


    // --- High-Frequency Whistle Tool ---
    const whistleButton = document.getElementById('whistle-button');
    const frequencySlider = document.getElementById('frequency-slider');
    const frequencyDisplay = document.getElementById('frequency-display');
    const whistleVolumeSlider = document.getElementById('whistle-volume-slider');
    const whistleVisualizer = document.getElementById('whistle-visualizer');

    let oscillator;
    let whistleGainNode;
    let analyser;
    let isWhistlePlaying = false;
    let animationFrameId;
    let canvasCtx;

    if (whistleVisualizer) {
        canvasCtx = whistleVisualizer.getContext('2d');
    }

    function drawWaveform() {
        if (!isWhistlePlaying) {
            if(animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
             if (canvasCtx) {
                canvasCtx.fillStyle = '#e9ecef';
                canvasCtx.fillRect(0, 0, whistleVisualizer.width, whistleVisualizer.height);
             }
            return;
        }

        animationFrameId = requestAnimationFrame(drawWaveform);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = '#e9ecef';
        canvasCtx.fillRect(0, 0, whistleVisualizer.width, whistleVisualizer.height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#0dcaf0'; // Bootstrap 'info' color
        canvasCtx.beginPath();

        const sliceWidth = whistleVisualizer.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * whistleVisualizer.height / 2;

            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        canvasCtx.lineTo(whistleVisualizer.width, whistleVisualizer.height / 2);
        canvasCtx.stroke();
    }

    function startWhistle() {
        const context = getAudioContext();
        if (!context) return;
        
        oscillator = context.createOscillator();
        whistleGainNode = context.createGain();
        analyser = context.createAnalyser();
        analyser.fftSize = 2048;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequencySlider.value, context.currentTime);
        whistleGainNode.gain.setValueAtTime(whistleVolumeSlider.value, context.currentTime);

        oscillator.connect(whistleGainNode);
        whistleGainNode.connect(analyser);
        analyser.connect(context.destination);

        oscillator.start();

        isWhistlePlaying = true;
        whistleButton.innerHTML = `<i class="bi bi-stop-circle-fill me-2"></i> Detener Silbato`;
        whistleButton.classList.add('active', 'btn-danger');
        whistleButton.classList.remove('btn-info');
        
        drawWaveform();
    }

    function stopWhistle() {
        if (oscillator) {
            oscillator.stop();
            oscillator.disconnect();
            whistleGainNode.disconnect();
            analyser.disconnect();
            oscillator = null;
            whistleGainNode = null;
            analyser = null;
        }
        isWhistlePlaying = false;
        drawWaveform(); // This will clear the canvas and stop the loop
        whistleButton.innerHTML = `<i class="bi bi-play-circle-fill me-2"></i> Iniciar Silbato`;
        whistleButton.classList.remove('active', 'btn-danger');
        whistleButton.classList.add('btn-info');
    }

    if (whistleButton && frequencySlider && whistleVolumeSlider && frequencyDisplay && whistleVisualizer) {
        drawWaveform(); // Draw initial empty state

        whistleButton.addEventListener('click', () => {
            if (isWhistlePlaying) {
                stopWhistle();
            } else {
                startWhistle();
            }
        });

        frequencySlider.addEventListener('input', () => {
            const newFreq = frequencySlider.value;
            frequencyDisplay.textContent = newFreq;
            if (oscillator) {
                oscillator.frequency.setValueAtTime(newFreq, getAudioContext().currentTime);
            }
        });

        whistleVolumeSlider.addEventListener('input', () => {
            if (whistleGainNode) {
                whistleGainNode.gain.setValueAtTime(whistleVolumeSlider.value, getAudioContext().currentTime);
            }
        });
    }
});