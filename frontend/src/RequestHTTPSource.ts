import {NEmpty} from "./components/dataview.ts";
import {NInput, NInputGroup, NSelect} from "./components/input.ts";
import {get_request} from "./store.ts";
import {api} from "./api.ts";
import {database} from "../wailsjs/go/models.ts";
import {m} from "./utils.ts";

type Request = database.HTTPSourceRequest;

type AuthType = "none" | "basic" | "bearer" | "apikey" | "oauth";
type SpecSource = "file" | "url";

// Type declaration for showOpenFilePicker
declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      types?: Array<{
        description: string,
        accept: Record<string, string[]>,
      }>,
      multiple?: boolean,
    }) => Promise<FileSystemFileHandle[]>,
  }
}

function StatusLabel() {
  const el = m("div", {style: {fontSize: ".8em", height: "1.2em"}});
  return {
    el,
    setStatus(message: string, isSuccess: boolean) {
      el.textContent = message;
      el.style.color = isSuccess ? "green" : "red";
    },
  };
}

function AuthFields(auth: database.AuthConfig, onUpdate: (patch: Partial<database.AuthConfig>) => void) {
  // Ensure auth.type is valid
  const validAuthTypes = ["none", "basic", "bearer", "apikey", "oauth"];
  const validAuthType = validAuthTypes.includes(auth.type) ? auth.type : "none";
  // If auth.type was invalid, update it
  if (validAuthType !== auth.type) {
    onUpdate({type: validAuthType as AuthType});
  }

  const authTypeSelect = NSelect({
    label: validAuthType,
    options: [
      {label: "none", value: "none"},
      {label: "basic", value: "basic"},
      {label: "bearer", value: "bearer"},
      {label: "apikey", value: "apikey"},
      {label: "oauth", value: "oauth"},
    ],
    on: {update: (type: string) => onUpdate({type: type as AuthType})},
  });

  const fields: HTMLElement[] = [m("label", "Auth Type"), authTypeSelect.el];

  switch (auth.type) {
  case "basic":
    fields.push(
      m("label", "Username"), NInput({value: auth.username ?? "", on: {update: (v: string) => onUpdate({username: v})}}),
      m("label", "Password"), NInput({value: auth.password ?? "", on: {update: (v: string) => onUpdate({password: v})}}),
    );
    break;
  case "bearer":
    fields.push(
      m("label", "Token"), NInput({value: auth.token ?? "", on: {update: (v: string) => onUpdate({token: v})}}),
    );
    break;
  case "apikey":
    fields.push(
      m("label", "Key Name"), NInput({value: auth.keyName ?? "", on: {update: (v: string) => onUpdate({keyName: v})}}),
      m("label", "Key Value"), NInput({value: auth.keyValue ?? "", on: {update: (v: string) => onUpdate({keyValue: v})}}),
    );
    break;
  case "oauth":
    fields.push(
      m("label", "Token"), NInput({value: auth.token ?? "", on: {update: (v: string) => onUpdate({token: v})}}), // placeholder
    );
    break;
  }

  return m("div", {style: {display: "flex", flexDirection: "column", gap: ".5em"}}, ...fields);
}

export default function(
  el: HTMLElement,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
  },
): {
  loaded: (r: get_request) => void,
  unmount(): void,
} {
  el.replaceChildren(NEmpty({description: "Loading source..."}));
  const unmounts: (() => void)[] = [];

  return {
    loaded: (r: get_request): void => {
      const requestID = r.request.id;
      const request = r.request as Request;
      const statusLabel = StatusLabel();

      const updateConnectionStatus = async (): Promise<void> => {
        const res = await api.requestTestHTTPSource(requestID);
        res.map_or_else(
          _ => statusLabel.setStatus("Spec loaded successfully!", true),
          err => statusLabel.setStatus(`Spec load failed: ${err}`, false),
        );
      };

      const update_request = async (patch: Partial<Request>): Promise<void> => {
        // Update local request object properties
        Object.assign(request, patch);
        // Update backend
        await on.update(patch);
        await updateConnectionStatus();

        // Update UI if auth changed
        if (patch.auth !== undefined) {
          updateAuthFields();
        }
        // Update spec input UI if spec source or data changed
        if (patch.specSource !== undefined || patch.specData !== undefined) {
          updateSpecInputUI();
        }
      };

      // Create input components
      const serverUrlInput = NInput({
        placeholder: "https://api.example.com",
        value: request.serverUrl,
        on: {update: (newValue: string) => update_request({serverUrl: newValue})},
      });

      const specInput = m("div", {style: {display: "flex", width: "100%"}});

      const updateSpecInputUI = () => {
        specInput.replaceChildren();
        if (request.specSource === "file") {
          const fileButton = m("button", {
            style: {
              border: "1px solid #ccc",
              padding: "4px 8px",
              cursor: "pointer",
              backgroundColor: "#f5f5f5",
            },
            onclick: async () => {
              try {
                if (window.showOpenFilePicker === undefined) {
                  throw new Error("File System Access API not supported");
                }
                const fileHandles = await window.showOpenFilePicker({
                  types: [
                    {
                      description: "OpenAPI/Swagger Files",
                      accept: {
                        "application/json": [".json", ".yaml", ".yml"],
                        "application/yaml": [".yaml", ".yml"],
                      },
                    },
                  ],
                  multiple: false,
                });
                if (fileHandles.length > 0) {
                  const file = await fileHandles[0].getFile();
                  const content = await file.text();
                  update_request({specData: content});
                }
              } catch (err) {
                console.error("File picker error:", err);
              }
            },
          }, "Choose File");
          specInput.appendChild(fileButton);

          if (request.specData !== "") {
            const preview = m("div", {
              style: {
                marginLeft: "8px",
                fontSize: ".8em",
                color: "#666",
                alignSelf: "center",
              },
            }, `Loaded: ${request.specData.length} chars`);
            specInput.appendChild(preview);
          }
        } else {
          const urlInput = NInput({
            placeholder: "Spec URL",
            value: request.specData,
            on: {update: (newValue: string) => update_request({specData: newValue})},
          });
          specInput.appendChild(urlInput);
        }
      };

      updateSpecInputUI();

      // Ensure specSource is valid
      const validSpecSource = ["file", "url"].includes(request.specSource) ? request.specSource : "file";
      // If specSource was invalid, update it
      if (validSpecSource !== request.specSource) {
        update_request({specSource: validSpecSource as SpecSource});
      }

      const specSourceSelect = NSelect({
        label: validSpecSource,
        options: [
          {label: "file", value: "file"},
          {label: "url", value: "url"},
        ],
          on: {update: (source: string) => {
            update_request({specSource: source as SpecSource});
            // Update the UI to show file picker or URL input
            request.specSource = source as SpecSource;
            updateSpecInputUI();
          }},
      });

      const authFieldsContainer = m("div");
      const updateAuthFields = () => authFieldsContainer.replaceChildren(AuthFields(request.auth, (patch) => {
        update_request({auth: {...request.auth, ...patch}});
      }));
      updateAuthFields();

      const el_connection_tab = NInputGroup({
        style: {
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: ".8em",
          padding: "0 3em",
        },
      }, [
        m("label", "Server URL"), serverUrlInput,
        m("label", "Spec Source"), specSourceSelect.el,
        m("label", "Spec Data"), specInput,
        m("label", "Authentication"), authFieldsContainer,
        statusLabel.el,
      ]);

      // Remove tabs since we only have Connection tab now
      // Just show the connection tab content directly
      el.replaceChildren(el_connection_tab);
      updateConnectionStatus();
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
};
