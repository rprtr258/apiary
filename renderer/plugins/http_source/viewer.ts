import * as t from "@/types.ts";
import {m} from "../../lib/utils.ts";
import {useRequest} from "../../hooks/useRequest.ts";
import {api} from "../../api.ts";
import {get_request} from "../../store.ts";
import {NEmpty, StatusLabel} from "../../components/dataview.ts";
import {NInput, NInputGroup, NSelect} from "../../components/input.ts";

type Request = t.HTTPSourceRequest;

const specSources: t.HTTPSourceSpecSource[] = ["file", "url"];
const specSourceOptions = specSources.map(source => ({label: source, value: source}));

const authTypes: t.AuthType[] = ["none", "basic", "bearer", "apikey", "oauth"];
const authTypesOptions = authTypes.map(typ => ({label: typ, value: typ}));

// Type declaration for showOpenFilePicker
declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      types?: {
        description: string,
        accept: Record<string, string[]>,
      }[],
      multiple?: boolean,
    }) => Promise<FileSystemFileHandle[]>,
  }
}

function AuthFields(auth: t.AuthConfig, onUpdate: (patch: Partial<t.AuthConfig>) => void) {
  const authTypeSelect = NSelect<t.AuthType>({
    label: auth.type,
    options: authTypesOptions,
    on: {update: type => onUpdate({type})},
  });

  const fields: HTMLElement[] = [m("label", {}, "Auth Type"), authTypeSelect.el];
  switch (auth.type) {
  case "basic":
    fields.push(
      m("label", {}, "Username"), NInput({value: auth.username, on: {update: (v: string) => onUpdate({username: v})}}),
      m("label", {}, "Password"), NInput({value: auth.password, on: {update: (v: string) => onUpdate({password: v})}}),
    );
    break;
  case "bearer":
    fields.push(
      m("label", {}, "Token"), NInput({value: auth.token, on: {update: (v: string) => onUpdate({token: v})}}),
    );
    break;
  case "apikey":
    fields.push(
      m("label", {}, "Key Name"), NInput({value: auth.key, on: {update: (v: string) => onUpdate({key: v})}}),
      m("label", {}, "Key Value"), NInput({value: auth.value, on: {update: (v: string) => onUpdate({value: v})}}),
    );
    break;
  case "oauth":
    fields.push(
      m("label", {}, "Token"), NInput({value: auth.token, on: {update: (v: string) => onUpdate({token: v})}}), // placeholder // TODO: implement
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
        statusLabel.setStatus(res.map_or_else(
          _ => "Spec loaded successfully!",
          err => `Spec load failed: ${err}`,
        ), res.kind === "ok");
      };

      const requestHook = useRequest<Request>({initialRequest: request, on: {update: async newRequest => {
        // Persist first; the status refresh runs after commit so its failure
        // cannot roll back a successful persist.
        await on.update(newRequest);
        await updateConnectionStatus().catch(() => {});
      }}});
      const update_request = async (patch: Partial<Request>): Promise<void> => {
        try {
          await requestHook.update(patch);
        } catch {
          // Persist failed and the hook rolled back; rebuild the UI so widgets match the reverted state.
          serverUrlInput.value = requestHook.request.serverUrl;
          updateAuthFields();
          updateSpecInputUI();
          specSourceSelect.set(requestHook.request.specSource);
          return;
        }

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
        switch (requestHook.request.specSource) {
        case "file": {
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

          if (requestHook.request.specData !== "") {
            const preview = m("div", {
              style: {
                marginLeft: "8px",
                fontSize: ".8em",
                color: "#666",
                alignSelf: "center",
              },
            }, `Loaded: ${requestHook.request.specData.length} chars`);
            specInput.appendChild(preview);
          }
          break;
        }
        case "url": {
          const urlInput = NInput({
            placeholder: "Spec URL",
            value: requestHook.request.specData,
            on: {update: (newValue: string) => update_request({specData: newValue})},
            style: {width: "100%"},
          });
          specInput.appendChild(urlInput);
          break;
        }
        }
      };

      updateSpecInputUI();

      const specSourceSelect = NSelect<t.HTTPSourceSpecSource>({
        label: request.specSource,
        options: specSourceOptions,
          on: {update: specSource => {
            // Update the UI to show file picker or URL input; update_request rebuilds it on success.
            update_request({specSource});
          }},
      });

      const authFieldsContainer = m("div");
      const updateAuthFields = () => authFieldsContainer.replaceChildren(AuthFields(requestHook.request.auth, patch => {
        update_request({auth: {...requestHook.request.auth, ...patch} as t.AuthConfig});
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
        m("label", {}, "Server URL"), serverUrlInput,
        m("label", {}, "Spec Source"), specSourceSelect.el,
        m("label", {}, "Spec Data"), specInput,
        m("label", {}, "Authentication"), authFieldsContainer,
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
