import type { AbsolutePath, AsyncMutable, RangeQuery } from "./types.js";

/**
 * WellKnownDirectory is a string that corresponds to a common directory (e.g. "documents").
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#parameters
 */
type WellKnownDirectory = "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";

/**
 * DirectoryPickerOptions is an object that can be passed to the `showDirectoryPicker` method to modify its behavior.
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#parameters
 */
interface DirectoryPickerOptions {
  // Providing an id remembers the directory that the user selected the last time they used the picker
  id?: string;
  mode?: "read" | "readwrite";
  // can be a FileSystemDirectoryHandle or a string corresponding to a common directory (e.g. "documents")
  startIn?: FileSystemHandle | WellKnownDirectory;
}

// Type aliases to make the `accept` property of the FilePickerAcceptType interface more readable
type MIMEType = string;
type Extensions = string[];

/**
 * FilePickerAcceptType is used to specify the types of files that the user can select in the file picker.
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/showFilePicker#parameters
 */
interface FilePickerAcceptType {
  description?: string;
  accept: Record<MIMEType, Extensions[]>;
}

/**
 * OpenFilePickerOptions is an object that can be passed to the `showFilePicker` method to modify its behavior.
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/showFilePicker#parameters
 */
interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

interface SaveFilePickerOptions {
  excludeAcceptAllOption?: boolean;
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

// Default options for the `showDirectoryPicker` method
const defaultDirectoryPickerOptions: DirectoryPickerOptions = {
  id: "zarrita-fs-access-store",
  mode: "read",
};

// Add the File System Access API methods to the window object for TypeScript
declare global {
  interface Window {
    showDirectoryPicker: (
      options?: DirectoryPickerOptions
    ) => Promise<FileSystemDirectoryHandle>;
    showFilePicker: (
      options?: OpenFilePickerOptions
    ) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker: (
      options?: SaveFilePickerOptions
    ) => Promise<FileSystemFileHandle>;
  }
  // Add the async iterator methods `values`, `entries`, and `keys` methods to the FileSystemDirectoryHandle interface for TypeScript
  // https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle#instance_methods
  interface FileSystemDirectoryHandle {
    values: () => AsyncIterableIterator<FileSystemHandle>;
    entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    keys: () => AsyncIterableIterator<string>;
  }
}


// Adapted from https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle#return_handles_for_all_files_in_a_directory
const handleIsFile = (handle: FileSystemHandle): handle is FileSystemFileHandle => handle.kind === "file";
const handleIsDirectory = (handle: FileSystemHandle): handle is FileSystemDirectoryHandle => handle.kind === "directory";
async function* getFilesRecursively(entry: FileSystemHandle): AsyncGenerator<File> {
    if (handleIsFile(entry)) {
      const file = await entry.getFile();
      if (file !== null) {
        yield file;
      }
    } else if (handleIsDirectory(entry)) {
      for await (const handle of entry.values()) {
        yield* getFilesRecursively(handle);
      }
    }
  }

/**
 * This loader uses the File System Access API to load files from the user's local file system.
 * This API is only supported by Chrome/Edge/Opera browsers and is only available in secure contexts with transient user activation.
 * Secure Contexts are pages loaded using HTTPS or loaded from localhost.
 * https://caniuse.com/native-filesystem-api
 * User activation occurs when the user clicks on/interacts with something on the page.
 * https://developer.mozilla.org/en-US/docs/Web/Security/User_activation#transient_activation
 */
class FileSystemAccessStore implements AsyncMutable {

  private directoryHandle: FileSystemDirectoryHandle | undefined = undefined;
  public isInitialized: boolean = false;

  /**
   * The constructor is used to create a new store object.
   * The store is not functional until the async init method is called.
   */
  constructor() {}

  /**
   * The init method is used to initialize the FileSystemDirectoryHandle.
   *
   * It is called by the constructor to initialize the directoryHandle property.
   *
   * If initialization succeeds, the isInitialized property is set to true.
   *
   * If initialization fails, the function is added as an event listener to the document object.
   *
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    // Check if the File System Access API is supported
    if (!("showDirectoryPicker" in window)) {
        console.error('Your browser does not support the File System Access API. Please see https://caniuse.com/native-filesystem-api');
        return;
    }
    if (navigator.userActivation.isActive) {
        try {
            const handle = await window.showDirectoryPicker({ ...defaultDirectoryPickerOptions, startIn: 'downloads'});
            if (handle) {
              this.directoryHandle = handle;
              this.isInitialized = true;
              console.debug("Directory handle initialized successfully.", this.directoryHandle, this.isInitialized);
              return;
            }
        } catch (err: unknown) {
            // If user manually aborted the directory picker, don't reattempt init until manually triggered by calling `init` again.
            if (err instanceof DOMException) {
                console.error("User aborted the directory picker. Init will not be reattempted until manually triggered.");
                return;
            }
            console.error(err);
        }
    }
    document.addEventListener("click", this.init, { once: true });
  }
  
  async get(key: `/${string}`, opts?: unknown): Promise<Uint8Array | undefined> {
    if (!this.isInitialized || !this.directoryHandle) {
        throw new Error("FileSystemAccessStore is not initialized. Please call the init method before calling the get method.");
    }
    
    const files: File[] = [];
    for await (const file of getFilesRecursively(this.directoryHandle)) {
        files.push(file);
    }
    console.debug("Files found in directory", files);

    throw new Error("Method not yet implemented.");
  }

  getRange?(
    key: `/${string}`,
    range: RangeQuery,
    opts?: unknown
  ): Promise<Uint8Array | undefined> {
    throw new Error("Method not yet implemented.");
  }
  
  set(key: `/${string}`, value: Uint8Array): Promise<void> {
    throw new Error("Method not yet implemented.");
  }
}

export default FileSystemAccessStore;
