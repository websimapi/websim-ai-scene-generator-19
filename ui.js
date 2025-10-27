import { getAssetById, updateAsset, sceneState, markAsDirty } from './state.js';
import { redrawCanvas, setTool, clearAssetImages } from './editor.js';

export let lastGeneratedAsset = null;

const loadingOverlay = document.getElementById('loading-overlay');
const propertiesPanel = document.getElementById('properties-panel-content');
const scenePrompt = document.getElementById('scene-prompt');
const assetPrompt = document.getElementById('asset-prompt');
const saveBtn = document.getElementById('save-btn');
const assetLibrary = document.getElementById('asset-library');

let isFastForwardingScene = false;
let isFastForwardingAsset = false;

/**
 * Stops the placeholder animation, fills the input with the current suggestion,
 * and focuses the element.
 * @param {HTMLElement} element - The input or textarea element.
 */
function finalizeSuggestion(element) {
    element.value = element.placeholder;
    element.placeholder = ''; // Clear placeholder to show the value
    
    // Add animation class and remove it after it completes
    element.classList.add('colorize-animation');
    element.addEventListener('animationend', () => {
        element.classList.remove('colorize-animation');
    }, { once: true });

    element.focus();
    // Move cursor to the end
    const fullText = element.value;
    element.setSelectionRange(fullText.length, fullText.length);
}

export function showLoader() {
    loadingOverlay.style.display = 'flex';
}

export function hideLoader() {
    loadingOverlay.style.display = 'none';
}

export function updateLastGeneratedAsset(asset) {
    lastGeneratedAsset = asset;
}

export function selectLibraryAsset(element) {
    document.querySelectorAll('.library-asset').forEach(el => el.classList.remove('selected'));
    if (element) {
        element.classList.add('selected');
        updateLastGeneratedAsset({
            id: `asset_${Date.now()}`, // This is a template, ID will be unique on drop
            url: element.dataset.assetUrl,
            type: element.dataset.assetType,
            prompt: element.dataset.assetPrompt
        });
        updatePropertiesPanel(element.dataset.assetId); // This was missing
        // On mobile, selecting an asset should prime the "add" tool for tap-to-place
        if ('ontouchstart' in window) {
            setTool('add');
        }
    } else {
        updateLastGeneratedAsset(null);
        updatePropertiesPanel(null); // Also clear panel when deselecting
    }
}

function renderBackgroundLayers(selectedAsset) {
    const layersContainer = document.getElementById('background-layers');
    if (!layersContainer) return;

    layersContainer.innerHTML = ''; // Clear existing layers

    for (let i = 0; i < 3; i++) {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'background-layer-slot';
        
        if (sceneState.backgrounds[i]) {
            layerDiv.innerHTML = `
                <img src="${sceneState.backgrounds[i]}" class="layer-thumbnail">
                <span>Layer ${i + 1}</span>
                <button class="remove-layer-btn" data-index="${i}">X</button>
            `;
        } else {
            layerDiv.innerHTML = `<span>Layer ${i + 1} (Empty)</span>`;
        }
        layersContainer.appendChild(layerDiv);
    }

    document.querySelectorAll('.remove-layer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            sceneState.backgrounds.splice(index, 1);
            markAsDirty();
            redrawCanvas();
            renderBackgroundLayers(selectedAsset); // Re-render layers
        });
    });
}


export function updatePropertiesPanel(assetId) {
    const isLibraryAsset = !getAssetById(assetId);
    let asset;
    
    if (isLibraryAsset) {
        // This is a temporary object for display from a library selection
        const selectedLibraryAsset = document.querySelector('.library-asset.selected');
        if (!selectedLibraryAsset) {
             propertiesPanel.innerHTML = '<p>Select an asset to see its properties.</p>';
             return;
        }
         asset = {
            id: selectedLibraryAsset.dataset.assetId,
            url: selectedLibraryAsset.dataset.assetUrl,
            type: selectedLibraryAsset.dataset.assetType,
            prompt: selectedLibraryAsset.dataset.assetPrompt,
            name: `${selectedLibraryAsset.dataset.assetType} - ${selectedLibraryAsset.dataset.assetPrompt.substring(0, 15)}...`
        };
    } else {
        asset = getAssetById(assetId);
    }
    
    if (!assetId && !asset) {
        propertiesPanel.innerHTML = '<p>Select an asset to see its properties.</p>';
        return;
    }

    if (!asset) {
        propertiesPanel.innerHTML = '<p>Asset not found.</p>';
        return;
    }

    let commonFields = `
        <div class="control-group">
            <label>Name</label>
            <input type="text" id="prop-name" value="${asset.name}" ${isLibraryAsset ? 'disabled' : ''}>
            <label>Type</label>
            <input type="text" id="prop-type" value="${asset.type}" disabled>
            <label>Prompt</label>
            <textarea id="prop-prompt" rows="3" disabled>${asset.prompt}</textarea>
    `;

    if (asset.type === 'Background') {
        propertiesPanel.innerHTML = `
            ${commonFields}
            </div>
            <div class="control-group">
                <h3>Background Layers</h3>
                <div id="background-layers">
                    <!-- Layers will be rendered here by JS -->
                </div>
                <button id="add-background-layer-btn">Add as Background Layer</button>
            </div>
        `;
        renderBackgroundLayers(asset);
        
        const addLayerBtn = document.getElementById('add-background-layer-btn');
        addLayerBtn.addEventListener('click', () => {
            if (sceneState.backgrounds.length < 3) {
                sceneState.backgrounds.push(asset.url);
                markAsDirty();
                redrawCanvas();
                renderBackgroundLayers(asset);
            } else {
                alert('Maximum of 3 background layers reached.');
            }
        });

    } else {
         propertiesPanel.innerHTML = `
            ${commonFields}
                <label>X</label>
                <input type="number" id="prop-x" value="${Math.round(asset.x)}">
                <label>Y</label>
                <input type="number" id="prop-y" value="${Math.round(asset.y)}">
                <label>Width</label>
                <input type="number" id="prop-width" value="${Math.round(asset.width)}">
                <label>Height</label>
                <input type="number" id="prop-height" value="${Math.round(asset.height)}">
            </div>
        `;
        document.getElementById('prop-x').addEventListener('change', (e) => {
            updateAsset(assetId, { x: parseInt(e.target.value, 10) });
            redrawCanvas();
        });
        document.getElementById('prop-y').addEventListener('change', (e) => {
            updateAsset(assetId, { y: parseInt(e.target.value, 10) });
            redrawCanvas();
        });
        document.getElementById('prop-width').addEventListener('change', (e) => {
            updateAsset(assetId, { width: parseInt(e.target.value, 10) });
            redrawCanvas();
        });
        document.getElementById('prop-height').addEventListener('change', (e) => {
            updateAsset(assetId, { height: parseInt(e.target.value, 10) });
            redrawCanvas();
        });
    }

    if (!isLibraryAsset) {
        document.getElementById('prop-name').addEventListener('change', (e) => updateAsset(assetId, { name: e.target.value }));
    }
}

// --- Scene Prompt Animation ---
const placeholderPrompts = [
    "A vibrant, magical forest clearing at dusk, fantasy art",
    "Cyberpunk city street at night, neon lights, rain",
    "Underwater coral reef teeming with bioluminescent creatures",
    "Steampunk airship soaring through clouds above a mountain range",
    "Alien desert landscape with two suns setting",
    "Cozy medieval tavern with a crackling fireplace",
    "Post-apocalyptic city ruins overgrown with nature",
    "Futuristic space station orbiting a gas giant",
    "Japanese zen garden with cherry blossoms and a koi pond",
    "Haunted Victorian mansion on a stormy night"
];

let promptIndex = 0;
let charIndex = 0;
let isDeleting = false;
let sceneAnimationTimeoutId;
let isSceneAnimationRunning = false;

function animatePlaceholder() {
    if (!isSceneAnimationRunning) return;

    const currentPrompt = placeholderPrompts[promptIndex];
    let targetText;

    if (isDeleting) {
        targetText = currentPrompt.substring(0, charIndex--);
    } else {
        targetText = currentPrompt.substring(0, charIndex++);
    }

    scenePrompt.placeholder = targetText;

    if (!isDeleting && charIndex === currentPrompt.length + 1) {
        if (isFastForwardingScene) {
            stopScenePlaceholderAnimation();
            finalizeSuggestion(scenePrompt);
            isFastForwardingScene = false;
            return;
        }
        isDeleting = true;
        sceneAnimationTimeoutId = setTimeout(animatePlaceholder, 2000); // Pause before deleting
        return;
    }

    if (isDeleting && charIndex === -1) {
        if (isFastForwardingScene) {
            // This case should not be hit if logic is correct, but as a fallback:
            isFastForwardingScene = false;
            isDeleting = false;
            charIndex = 0;
        } else {
            isDeleting = false;
            promptIndex = (promptIndex + 1) % placeholderPrompts.length;
            charIndex = 0;
        }
        sceneAnimationTimeoutId = setTimeout(animatePlaceholder, isFastForwardingScene ? 0 : 500); // Pause before typing next
        return;
    }

    const typingSpeed = isDeleting ? 50 : 100;
    sceneAnimationTimeoutId = setTimeout(animatePlaceholder, isFastForwardingScene ? 0 : typingSpeed);
}

function startScenePlaceholderAnimation() {
    if (isSceneAnimationRunning || scenePrompt.value.length > 0) return;
    isSceneAnimationRunning = true;
    animatePlaceholder();
}

function stopScenePlaceholderAnimation() {
    if (!isSceneAnimationRunning) return;
    isSceneAnimationRunning = false;
    clearTimeout(sceneAnimationTimeoutId);
    if (!isFastForwardingScene) {
        scenePrompt.placeholder = "A vibrant, magical forest...";
    }
    promptIndex = 0;
    charIndex = 0;
    isDeleting = false;
}


// --- Asset Prompt Animation ---
const assetPlaceholderPrompts = [
    "A glowing crystal",
    "A rusty sword",
    "A small wooden chest",
    "A magical potion bottle",
    "An ancient, moss-covered stone statue",
    "A friendly robot companion",
    "A futuristic hovercraft",
    "A pile of gold coins",
    "A mysterious, locked book",
    "A talking animal sidekick"
];
let assetPromptIndex = 0;
let assetCharIndex = 0;
let isAssetDeleting = false;
let assetAnimationTimeoutId;
let isAssetAnimationRunning = false;

function animateAssetPlaceholder() {
    if (!isAssetAnimationRunning) return;

    const currentPrompt = assetPlaceholderPrompts[assetPromptIndex];
    let targetText;

    if (isAssetDeleting) {
        targetText = currentPrompt.substring(0, assetCharIndex--);
    } else {
        targetText = currentPrompt.substring(0, assetCharIndex++);
    }

    assetPrompt.placeholder = targetText;

    if (!isAssetDeleting && assetCharIndex === currentPrompt.length + 1) {
        if (isFastForwardingAsset) {
            stopAssetPlaceholderAnimation();
            finalizeSuggestion(assetPrompt);
            isFastForwardingAsset = false;
            return;
        }
        isAssetDeleting = true;
        assetAnimationTimeoutId = setTimeout(animateAssetPlaceholder, 2000); // Pause before deleting
        return;
    }

    if (isAssetDeleting && assetCharIndex === -1) {
         if (isFastForwardingAsset) {
            isFastForwardingAsset = false;
            isAssetDeleting = false;
            assetCharIndex = 0;
        } else {
            isAssetDeleting = false;
            assetPromptIndex = (assetPromptIndex + 1) % assetPlaceholderPrompts.length;
            assetCharIndex = 0;
        }
        assetAnimationTimeoutId = setTimeout(animateAssetPlaceholder, isFastForwardingAsset ? 0 : 500); // Pause before typing next
        return;
    }

    const typingSpeed = isAssetDeleting ? 50 : 100;
    assetAnimationTimeoutId = setTimeout(animateAssetPlaceholder, isFastForwardingAsset ? 0 : typingSpeed);
}

function startAssetPlaceholderAnimation() {
    if (isAssetAnimationRunning) return;
    isAssetAnimationRunning = true;
    animateAssetPlaceholder();
}

function stopAssetPlaceholderAnimation() {
    if (!isAssetAnimationRunning) return;
    isAssetAnimationRunning = false;
    clearTimeout(assetAnimationTimeoutId);
    if (!isFastForwardingAsset) {
        assetPrompt.placeholder = "Type here to generate asset";
    }
    assetPromptIndex = 0;
    assetCharIndex = 0;
    isAssetDeleting = false;
}


export function setupPanelToggles() {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const mobileToggleLeft = document.getElementById('mobile-toggle-left');
    const mobileToggleRight = document.getElementById('mobile-toggle-right');
    const toggleLeftPanelBtn = document.getElementById('toggle-left-panel');
    const toggleRightPanelBtn = document.getElementById('toggle-right-panel');
    const toolsDropdownBtn = document.getElementById('tools-dropdown-btn');
    const toolsDropdownContent = document.getElementById('tools-dropdown-content');
    const transparentToggleBtn = document.getElementById('asset-transparent-toggle');
    const assetTypeSelector = document.getElementById('asset-type-selector');

    // --- Animation and Interaction Setup ---
    startScenePlaceholderAnimation(); // Start scene animation by default
    
    scenePrompt.addEventListener('input', () => {
        isFastForwardingScene = false;
        stopScenePlaceholderAnimation();
    });
    scenePrompt.addEventListener('dblclick', () => {
        if (isSceneAnimationRunning && !isFastForwardingScene) {
            isFastForwardingScene = true;
            clearTimeout(sceneAnimationTimeoutId);
            if(isDeleting) {
                isDeleting = false;
            }
            animatePlaceholder();
        }
    });

    assetPrompt.addEventListener('input', () => {
        isFastForwardingAsset = false;
        stopAssetPlaceholderAnimation();
    });
    assetPrompt.addEventListener('dblclick', () => {
        if (isAssetAnimationRunning && !isFastForwardingAsset) {
            isFastForwardingAsset = true;
            clearTimeout(assetAnimationTimeoutId);
            if(isAssetDeleting) {
                isAssetDeleting = false;
            }
            animateAssetPlaceholder();
        }
    });

    // Asset Type Button Logic
    assetTypeSelector.addEventListener('click', (e) => {
        const button = e.target.closest('.asset-type-btn');
        if (!button) return;

        assetTypeSelector.querySelectorAll('.asset-type-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Always show the transparency toggle
        transparentToggleBtn.style.display = 'block';
    });

    transparentToggleBtn.addEventListener('click', () => {
        const isToggledOn = transparentToggleBtn.classList.toggle('toggled-on');
        const icon = transparentToggleBtn.querySelector('img');
        if (isToggledOn) {
            icon.src = './eye_slash_icon.png';
            icon.alt = 'Transparency On';
        } else {
            icon.src = './eye_icon.png';
            icon.alt = 'Transparency Off';
        }
    });
    // Set initial state based on class
    transparentToggleBtn.classList.add('toggled-on');


    const togglePanel = (panel) => {
        const isVisible = panel.classList.contains('visible');
        document.querySelectorAll('#left-panel, #right-panel').forEach(p => p.classList.remove('visible'));
        if (!isVisible) {
            panel.classList.add('visible');
        }

        // Handle asset placeholder animation on mobile
        if ('ontouchstart' in window) {
            if (leftPanel.classList.contains('visible')) {
                startAssetPlaceholderAnimation();
            } else {
                stopAssetPlaceholderAnimation();
            }
        }
    };

    mobileToggleLeft.addEventListener('click', () => togglePanel(leftPanel));
    mobileToggleRight.addEventListener('click', () => togglePanel(rightPanel));
    toggleLeftPanelBtn.addEventListener('click', () => leftPanel.classList.remove('visible'));
    toggleRightPanelBtn.addEventListener('click', () => rightPanel.classList.remove('visible'));

    // Dropdown toggle for mobile and consistency
    toolsDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent window click listener from closing it immediately
        toolsDropdownContent.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    window.addEventListener('click', (e) => {
        if (!toolsDropdownBtn.contains(e.target)) {
            if (toolsDropdownContent.classList.contains('show')) {
                toolsDropdownContent.classList.remove('show');
            }
        }
    });

    // Hide dropdown after a tool is selected
    toolsDropdownContent.addEventListener('click', () => {
        toolsDropdownContent.classList.remove('show');
    });

    // Handle asset placeholder animation on desktop
    if (!('ontouchstart' in window)) {
        assetPrompt.addEventListener('mouseenter', startAssetPlaceholderAnimation);
        assetPrompt.addEventListener('mouseleave', stopAssetPlaceholderAnimation);
    }
}

export function addAssetToLibrary(asset) {
    const img = document.createElement('img');
    img.src = asset.url;
    img.title = asset.prompt;
    img.classList.add('library-asset');
    img.draggable = true;
    img.dataset.assetId = asset.id; // May not be needed, but good practice
    img.dataset.assetUrl = asset.url;
    img.dataset.assetType = asset.type;
    img.dataset.assetPrompt = asset.prompt;

    assetLibrary.appendChild(img);
    return img;
}

export function updateSaveButtonState(isDirty) {
    if (isDirty) {
        saveBtn.classList.add('dirty');
    } else {
        saveBtn.classList.remove('dirty');
    }
}