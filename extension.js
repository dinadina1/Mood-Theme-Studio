/*
character count per 20 seconds
Focused - >30
tired - <10
neutral - 10 - 30
*/
const vscode = require('vscode');
let typingSpeedTracker, moodState = 'neutral', themeConfig, autoMoodDetectionEnabled = true;
let customThemes = {}; // Object to hold custom theme colors

// Class for tracking typing speed
class TypingSpeedTracker {
	constructor() {
		this.lastTypingTime = Date.now();
		this.typingIntervals = [];
	}

	// Track typing events and calculate typing speed
	trackTyping = () => {
		const now = Date.now();
		const interval = now - this.lastTypingTime;

		if (interval < 30000) {
			this.typingIntervals.push(interval);
			if (this.typingIntervals.length > 10) 
				this.typingIntervals.shift();
		}

		this.lastTypingTime = now;
	}

	// Get average typing speed (characters per minute)
	get typingSpeed() {
		const averageInterval = this.typingIntervals.length 
			? this.typingIntervals.reduce((a, b) => a + b, 0) / this.typingIntervals.length
			: 1000;

		return 6000 / averageInterval; // convert ms to chars/min
	}

	// Add reset method
	reset() {
		this.lastTypingTime = Date.now();
		this.typingIntervals = [];
	}
}

// Detect mood based on typing speed
function detectMood(typingSpeed) {
	if (typingSpeed >= 30) return 'focused';    // Default Dark Modern
	if (typingSpeed < 10) return 'tired';       // Default Light Modern
	return 'neutral';                           // Dark+
}

// Change the VS code theme based on detected mood
function setThemeByMood(mood) {
	let theme;
	
	switch(mood) {
		case 'focused':
			theme = 'Default Dark Modern';
			break;
		case 'tired':
			theme = 'Default Light Modern';
			break;
		default: // neutral
			theme = 'Default Dark+';
			break;
	}
	
	vscode.workspace.getConfiguration().update('workbench.colorTheme', theme, vscode.ConfigurationTarget.Global);
	typingSpeedTracker.reset(); // Reset timing after theme change
}

// Update mood and theme every interval if autoMoodDetection is enabled
function updateMoodAndTheme() {
	if (!autoMoodDetectionEnabled) return;

	const typingSpeed = typingSpeedTracker.typingSpeed;
	const detectedMood = detectMood(typingSpeed);
    console.log(detectedMood);  
    console.log(typingSpeed);
    

	// if (detectedMood !== moodState) {
		moodState = detectedMood;
		setThemeByMood(moodState);
	// }
}

// Function to apply custom theme colors
function applyCustomTheme(customTheme) {
	vscode.workspace.getConfiguration().update('workbench.colorCustomizations', {
		"editor.background": customTheme.background,
		"editor.foreground": customTheme.text,
		"sideBar.background": customTheme.sidebar,
		"statusBar.background": customTheme.menu,
		"terminal.foreground": customTheme.font
	}, vscode.ConfigurationTarget.Global).then(() => {
		vscode.window.showInformationMessage('Custom theme applied successfully!');
	});
}

// Function to reset custom theme to default
function resetToDefaultTheme() {
	vscode.workspace.getConfiguration().update('workbench.colorCustomizations', {}, vscode.ConfigurationTarget.Global).then(() => {
		vscode.window.showInformationMessage('Custom theme cleared, reverted to default!');
	});
}

// Add this function to get all available VS Code themes
async function getAllThemes() {
    const extensions = vscode.extensions.all;
    const themes = [];

    // Get themes from VS Code configuration
    const themeSettings = vscode.workspace.getConfiguration('workbench');
    const currentTheme = themeSettings.get('colorTheme');

    extensions.forEach(extension => {
        if (extension.packageJSON.contributes && extension.packageJSON.contributes.themes) {
            extension.packageJSON.contributes.themes.forEach(theme => {
                themes.push({
                    label: theme.label || theme.id,
                    id: theme.id,
                    isCurrent: theme.id === currentTheme
                });
            });
        }
    });

    return themes;
}

// Modify the showFeatureMenu function
async function showFeatureMenu() {
	const mainOptions = [
		'Mood-Based Themes',
		'System Themes',
		'Set Custom Theme Colors',
		autoMoodDetectionEnabled ? 'Disable Auto Mood Detection' : 'Enable Auto Mood Detection'
	];

	if (customThemes['custom']) {
		mainOptions.push('Clear Custom Theme');
	}

	const choice = await vscode.window.showQuickPick(mainOptions, { 
		placeHolder: 'Choose theme category or toggle features' 
	});

	if (choice === 'Mood-Based Themes') {
		const moodOptions = [
			'Neutral Theme',
			'Focused Theme',
			'Tired Theme'
		];
		
		const moodChoice = await vscode.window.showQuickPick(moodOptions, {
			placeHolder: 'Select mood-based theme'
		});

		if (moodChoice) {
			autoMoodDetectionEnabled = false;
			vscode.window.showInformationMessage('Auto Mood Detection disabled due to manual theme selection');
			typingSpeedTracker.reset(); // Reset timing after manual selection

			if (moodChoice === 'Neutral Theme') {
				setThemeByMood('neutral');
			} else if (moodChoice === 'Focused Theme') {
				setThemeByMood('focused');
			} else if (moodChoice === 'Tired Theme') {
				setThemeByMood('tired');
			}
		}
	} else if (choice === 'System Themes') {
		const themes = await getAllThemes();
		const themeChoice = await vscode.window.showQuickPick(
			themes.map(theme => ({
				label: theme.label + (theme.isCurrent ? ' (Current)' : ''),
				description: theme.id
			})),
			{ placeHolder: 'Select a system theme' }
		);

		if (themeChoice) {
			autoMoodDetectionEnabled = false;
			vscode.window.showInformationMessage('Auto Mood Detection disabled due to manual theme selection');
			typingSpeedTracker.reset(); // Reset timing after system theme selection
			await vscode.workspace.getConfiguration().update(
				'workbench.colorTheme',
				themeChoice.description,
				vscode.ConfigurationTarget.Global
			);
		}
	} else if (choice === 'Set Custom Theme Colors') {
		await openColorPickerModal();
		autoMoodDetectionEnabled = false;
		vscode.window.showInformationMessage('Auto Mood Detection disabled due to custom theme selection');
	} else if (choice === 'Clear Custom Theme') {
		resetToDefaultTheme();
	} else if (choice === 'Disable Auto Mood Detection') {
		autoMoodDetectionEnabled = false;
		vscode.window.showInformationMessage(`Auto Mood Detection is now disabled`);
	} else if (choice === 'Enable Auto Mood Detection') {
		autoMoodDetectionEnabled = true;
		vscode.window.showInformationMessage(`Auto Mood Detection is now enabled`);
	}
}

// Function to open the color picker modal
async function openColorPickerModal() {
	const panel = vscode.window.createWebviewPanel(
		'colorPickerModal', // Identifies the type of the webview. Used internally
		'Custom Theme Color Picker', // Title of the panel displayed to the user
		vscode.ViewColumn.One, // Editor column to show the new webview panel in
		{
			enableScripts: true,
			retainContextWhenHidden: true,
		}
	);

	// HTML content for the webview
	panel.webview.html = getWebviewContent();

	// Handle message from the webview
	panel.webview.onDidReceiveMessage(
		message => {
			if (message.command === 'applyColors') {
				const { background, text, sidebar, menu, font } = message.colors;
				customThemes['custom'] = { background, text, sidebar, menu, font };
				applyCustomTheme(customThemes['custom']);
				panel.dispose();
			}
		},
		undefined
	);
}

// Improved HTML design with color picker and styled modal
function getWebviewContent() {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Custom Theme Colors</title>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background-color: #1e1e1e;
                color: white;
                background-image: linear-gradient(45deg, #1e1e1e 25%, #252525 25%, #252525 50%, #1e1e1e 50%, #1e1e1e 75%, #252525 75%, #252525 100%);
                background-size: 56.57px 56.57px;
            }
            .modal {
                background-color: #2d2d2d;
                padding: 30px;
                border-radius: 15px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                width: 400px;
                text-align: center;
                position: relative;
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
            }
            .modal::before {
                content: '';
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                background: linear-gradient(45deg, #007acc, #0063a3);
                z-index: -1;
                border-radius: 16px;
                opacity: 0.3;
            }
            h2 {
                color: #007acc;
                margin-bottom: 30px;
                font-size: 24px;
                text-shadow: 0 0 10px rgba(0, 122, 204, 0.3);
            }
            .color-picker {
                margin: 20px 0;
                padding: 15px;
                background-color: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .color-picker:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            label {
                font-size: 1.1em;
                font-weight: 500;
                color: #e0e0e0;
            }
            input[type="color"] {
                height: 40px;
                width: 60px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                background: transparent;
                transition: transform 0.2s;
            }
            input[type="color"]:hover {
                transform: scale(1.1);
            }
            .buttons-container {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-top: 30px;
            }
            button {
                padding: 12px 25px;
                background: linear-gradient(45deg, #007acc, #0063a3);
                border: none;
                color: white;
                font-size: 1.1em;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                font-weight: 500;
                letter-spacing: 1px;
                box-shadow: 0 4px 15px rgba(0, 122, 204, 0.2);
            }
            button:hover {
                background: linear-gradient(45deg, #0088e3, #0074c2);
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 122, 204, 0.3);
            }
            button:active {
                transform: translateY(1px);
            }
            .preview-box {
                margin-top: 25px;
                padding: 15px;
                border-radius: 8px;
                background-color: rgba(0, 0, 0, 0.2);
            }
            .preview-box h3 {
                margin: 0 0 10px 0;
                color: #007acc;
            }
            .preview-text {
                margin: 5px 0;
                font-size: 0.9em;
                color: #cccccc;
            }
        </style>
    </head>
    <body>
        <div class="modal">
            <h2>🎨 Custom Theme Colors</h2>
            <div class="color-picker">
                <label for="background">Background:</label>
                <input type="color" id="background" value="#1e1e1e">
            </div>
            <div class="color-picker">
                <label for="text">Text Color:</label>
                <input type="color" id="text" value="#ffffff">
            </div>
            <div class="color-picker">
                <label for="sidebar">Sidebar:</label>
                <input type="color" id="sidebar" value="#252526">
            </div>
            <div class="color-picker">
                <label for="menu">Menu Bar:</label>
                <input type="color" id="menu" value="#3c3c3c">
            </div>
            <div class="color-picker">
                <label for="font">Terminal Font:</label>
                <input type="color" id="font" value="#cccccc">
            </div>       

            <div class="buttons-container">
                <button onclick="applyColors()" title="Apply selected colors">
                    Apply Theme
                </button>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const defaultColors = {
                background: '#1e1e1e',
                text: '#ffffff',
                sidebar: '#252526',
                menu: '#3c3c3c',
                font: '#cccccc'
            };

            function applyColors() {
                const colors = {
                    background: document.getElementById('background').value,
                    text: document.getElementById('text').value,
                    sidebar: document.getElementById('sidebar').value,
                    menu: document.getElementById('menu').value,
                    font: document.getElementById('font').value,
                };
                vscode.postMessage({ command: 'applyColors', colors });
            }
        </script>
    </body>
    </html>`;
}

// Extension activation
function activate(context) {
	console.log('Mood-Based Theme Changer is activated now!');

	// Initialize theme configuration and tracking
	themeConfig = vscode.workspace.getConfiguration('moodBasedThemeChanger');
	typingSpeedTracker = new TypingSpeedTracker();

	// Listen to user typing activity
	vscode.workspace.onDidChangeTextDocument(typingSpeedTracker.trackTyping);

	// Schedule mood-based theme updates if autoMoodDetection is enabled
	setInterval(() => {
		updateMoodAndTheme();
	}, 20000); // 20 seconds

	// Command to show feature menu
	const manualThemeChange = vscode.commands.registerCommand('moodBasedThemeChanger.showFeatureMenu', showFeatureMenu);
	context.subscriptions.push(manualThemeChange);

	// Status Bar button with dropdown menu for manual theme selection and feature toggle
	const statusBarButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarButton.command = 'moodBasedThemeChanger.showFeatureMenu';
	statusBarButton.text = `$(paintcan) Set Theme/Features`; // Paintcan icon
	statusBarButton.tooltip = 'Choose Mood-Based Theme or Toggle Features';
	statusBarButton.show();

	// Add Status Bar button to subscriptions
	context.subscriptions.push(statusBarButton);
}

// Deactivation function
function deactivate() {}

module.exports = {
	activate,
	deactivate
};
