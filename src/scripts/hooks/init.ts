import { MystifiedTraits } from "@item/base/data/values.ts";
import { HotbarPF2e } from "@module/apps/hotbar.ts";
import {
    ActorDirectoryPF2e,
    ChatLogPF2e,
    CompendiumDirectoryPF2e,
    EncounterTrackerPF2e,
    ItemDirectoryPF2e,
} from "@module/apps/sidebar/index.ts";
import { setPerceptionModes } from "@module/canvas/perception/modes.ts";
import { RulerPF2e } from "@module/canvas/ruler.ts";
import { TokenConfigPF2e } from "@scene/token-document/sheet.ts";
import { PF2ECONFIG } from "@scripts/config/index.ts";
import { registerHandlebarsHelpers } from "@scripts/handlebars.ts";
import { registerFonts } from "@scripts/register-fonts.ts";
import { registerKeybindings } from "@scripts/register-keybindings.ts";
import { registerTemplates } from "@scripts/register-templates.ts";
import { SetGamePF2e } from "@scripts/set-game-pf2e.ts";
import { registerSettings } from "@system/settings/index.ts";
import { htmlQueryAll } from "@util";
import * as R from "remeda";

export const Init = {
    listen: (): void => {
        Hooks.once("init", () => {
            console.log("PF2e System | Initializing Pathfinder 2nd Edition System");

            CONFIG.PF2E = PF2ECONFIG;
            CONFIG.debug.ruleElement ??= false;

            setPerceptionModes();

            // Automatically advance world time by 6 seconds each round
            CONFIG.time.roundTime = 6;
            // No use of decimals as tie breakers among initiative values
            CONFIG.Combat.initiative.decimals = 0;

            // Assign the PF2e Sidebar subclasses
            CONFIG.ui.actors = ActorDirectoryPF2e;
            CONFIG.ui.items = ItemDirectoryPF2e;
            CONFIG.ui.combat = EncounterTrackerPF2e;
            CONFIG.ui.compendium = CompendiumDirectoryPF2e;
            CONFIG.ui.hotbar = HotbarPF2e;

            if (game.release.generation === 12) {
                CONFIG.ui.chat = ChatLogPF2e;
                CONFIG.Token.prototypeSheetClass = TokenConfigPF2e;
            }

            // Set after load in case of module conflicts
            if (!RulerPF2e.hasModuleConflict) CONFIG.Canvas.rulerClass = RulerPF2e;

            // The condition in Pathfinder 2e is "blinded" rather than "blind"
            CONFIG.specialStatusEffects.BLIND = "blinded";

            // Insert templates into DOM tree so Applications can render into
            if (document.querySelector("#ui-top") !== null) {
                // Template element for effects-panel
                const uiTop = document.querySelector("#ui-top");
                const template = document.createElement("template");
                template.setAttribute("id", "pf2e-effects-panel");
                uiTop?.insertAdjacentElement("afterend", template);
            }

            // Populate UUID redirects
            for (const [from, to] of R.entries(UUID_REDIRECTS)) {
                CONFIG.compendium.uuidRedirects[from] = to;
            }

            // Configure the bundled TinyMCE editor with PF2-specific options
            CONFIG.TinyMCE.extended_valid_elements = "pf2-action[action|glyph]";
            CONFIG.TinyMCE.content_css.push("systems/pf2e/styles/pf2e.css");
            CONFIG.TinyMCE.style_formats = (CONFIG.TinyMCE.style_formats ?? []).concat({
                title: "PF2E",
                items: [
                    {
                        title: "Icons 1 2 3 F R",
                        inline: "span",
                        classes: ["action-glyph"],
                        wrapper: true,
                    },
                    {
                        title: "Inline Header",
                        block: "h4",
                        classes: "inline-header",
                    },
                    {
                        title: "Info Block",
                        block: "section",
                        classes: "info",
                        wrapper: true,
                        exact: true,
                        merge_siblings: false,
                    },
                    {
                        title: "Stat Block",
                        block: "section",
                        classes: "statblock",
                        wrapper: true,
                        exact: true,
                        merge_siblings: false,
                    },
                    {
                        title: "Trait",
                        block: "section",
                        classes: "traits",
                        wrapper: true,
                    },
                    {
                        title: "Written Note",
                        block: "p",
                        classes: "message",
                    },
                    {
                        title: "GM Text Block",
                        block: "div",
                        wrapper: true,
                        attributes: {
                            "data-visibility": "gm",
                        },
                    },
                    {
                        title: "GM Text Inline",
                        inline: "span",
                        attributes: {
                            "data-visibility": "gm",
                        },
                    },
                ],
            });

            // Register custom enricher
            CONFIG.TextEditor.enrichers.push({
                pattern: /@(Check|Localize|Template)\[([^\]]+)\](?:{([^}]+)})?/g,
                enricher: (match, options) => game.pf2e.TextEditor.enrichString(match, options),
            });

            // Register damage enricher, which is more complicated and needs an extra level of nesting
            // Derived from https://stackoverflow.com/questions/17759004/how-to-match-string-within-parentheses-nested-in-java/17759264#17759264
            CONFIG.TextEditor.enrichers.push({
                pattern: /@(Damage)\[((?:[^[\]]|\[[^[\]]*\])*)\](?:{([^}]+)})?/g,
                enricher: (match, options) => game.pf2e.TextEditor.enrichString(match, options),
            });

            CONFIG.TextEditor.enrichers.push({
                pattern: /\[\[\/(act)\s+(?<slug>[-a-z]+)(?:\s+(?<options>[^\]]+))?\]\](?:\{(?<label>[^}]+)\})?/g,
                enricher: (match, options) => game.pf2e.TextEditor.enrichString(match, options),
            });

            // Soft-set system-preferred core settings until they've been explicitly set by the GM
            // const schema = foundry.data.PrototypeToken.schema;
            // schema.displayName.default = schema.displayBars.default = CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER;

            // Register stuff with the Foundry client
            registerFonts();
            registerHandlebarsHelpers();
            registerKeybindings();
            registerSettings();
            registerTemplates();

            MystifiedTraits.compile();

            // Create and populate initial game.pf2e interface
            SetGamePF2e.onInit();

            // Disable tagify style sheets from modules
            for (const element of htmlQueryAll(document.head, "link[rel=stylesheet]")) {
                const href = element.getAttribute("href");
                if (href?.startsWith("modules/") && href.endsWith("tagify.css")) {
                    element.setAttribute("disabled", "");
                }
            }

            game.pf2e.StatusEffects.initialize();
        });
    },
};
