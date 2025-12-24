

import Dexie, { Table } from 'dexie';
import { User, Equipment, Ad } from '../types';

class CineSafeDB extends Dexie {
  users!: Table<User>;
  equipment!: Table<Equipment>;
  ads!: Table<Ad>;

  constructor() {
    super('CineSafeDB');
    
    // Define Database Schema
    // We only specify keys that we want to index (search by)
    (this as any).version(1).stores({
      users: 'id, email, role', 
      equipment: 'id, ownerId, serialNumber, status, category, isForRent, isForSale',
      ads: 'id, active'
    });
  }
}

export const db = new CineSafeDB();