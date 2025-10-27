import { getAssetById, updateAsset, sceneState, markAsDirty } from './state.js';
import { redrawCanvas, setTool, clearAssetImages } from './editor.js';
import { updatePropertiesPanel, setupPanelToggles } from './panels.js';

export let lastGeneratedAsset = null;

const loadingOverlay = document.getElementById('loading-overlay');
const propertiesPanel = document.getElementById('properties-panel-content');
const scenePrompt = document.getElementById('scene-prompt');
const assetPrompt = document.getElementById('asset-prompt');
const saveBtn = document.getElementById('save-btn');
const assetLibrary = document.getElementById('asset-library');

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

export function initializeUi() {
    setupPanelToggles();
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