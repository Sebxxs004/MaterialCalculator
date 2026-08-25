import type { ProyectoGuardado } from '../types/material';

const DB_NAME = 'MaterialCalculatorDB';
const DB_VERSION = 1;
const STORE_NAME = 'proyectos';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Error al abrir la base de datos IndexedDB.'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export const projectStorageService = {
  async guardarProyecto(proyecto: ProyectoGuardado): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(proyecto);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Error al guardar el proyecto.'));
      };
    });
  },

  async obtenerProyectos(): Promise<ProyectoGuardado[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort projects by date descending (newest first)
        const projects = request.result as ProyectoGuardado[];
        projects.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        resolve(projects);
      };

      request.onerror = () => {
        reject(new Error('Error al obtener los proyectos.'));
      };
    });
  },

  async obtenerProyectoPorId(id: string): Promise<ProyectoGuardado | null> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Error al obtener el proyecto con id: ${id}`));
      };
    });
  },

  async eliminarProyecto(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Error al eliminar el proyecto con id: ${id}`));
      };
    });
  }
};
