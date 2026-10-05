import type { Livery } from './sprites/types';
import type { VehicleId } from '../data/types';

/**
 * 車両の塗装。
 * 形状は共通なので、ここを差し替えるだけで別形式の車両に見える。
 *
 * 実在のロゴやマークは使わず、「そう見える色」だけを再現している。
 */
export const LIVERIES: Readonly<Record<VehicleId, Livery>> = {
  // 岡山の顔。黄色一色の近郊電車。
  '115-yellow': {
    K: '#14161c', R: '#8a8f98', B: '#f2c230', S: '#e0a81c', D: '#e8b420',
    W: '#dfe4ea', G: '#26384d', U: '#2b2f38', L: '#fff4c2', P: '#5a606b',
  },
  // 快速マリンライナー。白地に青。
  '213-marine': {
    K: '#14161c', R: '#aeb6c0', B: '#f4f7fb', S: '#0b6ec4', D: '#dce6f2',
    W: '#dfe4ea', G: '#1d3a5c', U: '#2b2f38', L: '#fff4c2', P: '#5a606b',
  },
  '105-red': {
    K: '#14161c', R: '#8a8f98', B: '#c03a2b', S: '#a32c1f', D: '#b33526',
    W: '#dfe4ea', G: '#26384d', U: '#2b2f38', L: '#fff4c2', P: '#5a606b',
  },
  'kiha40-orange': {
    K: '#14161c', R: '#9aa0a8', B: '#d9622b', S: '#eee6d0', D: '#c8561f',
    W: '#dfe4ea', G: '#26384d', U: '#2b2f38', L: '#fff4c2', P: 'transparent',
  },
  'kiha120-mizurin': {
    K: '#14161c', R: '#aeb6c0', B: '#e8e8e8', S: '#1a6f3c', D: '#dcdcdc',
    W: '#dfe4ea', G: '#26384d', U: '#2b2f38', L: '#fff4c2', P: 'transparent',
  },
  'hot7000': {
    K: '#14161c', R: '#c8ccd2', B: '#f2f2f2', S: '#c8102e', D: '#e6e6e6',
    W: '#dfe4ea', G: '#1d3a5c', U: '#2b2f38', L: '#fff4c2', P: 'transparent',
  },
  ibara: {
    K: '#14161c', R: '#aeb6c0', B: '#ffffff', S: '#2e9e5b', D: '#eef5ef',
    W: '#dfe4ea', G: '#26384d', U: '#2b2f38', L: '#fff4c2', P: 'transparent',
  },
  'momo-tram': {
    K: '#14161c', R: '#3a4048', B: '#1f7a4a', S: '#c8d64a', D: '#18603a',
    W: '#dfe4ea', G: '#1d3a5c', U: '#2b2f38', L: '#fff4c2', P: '#5a606b',
  },
  'n700-shinkansen': {
    K: '#14161c', R: '#e8ecf1', B: '#f5f7fa', S: '#1b4f9c', D: '#e2e8f0',
    W: '#dfe4ea', G: '#1d3a5c', U: '#2b2f38', L: '#fff4c2', P: '#5a606b',
  },
};

/** 風景の色。路線ごとの scene で切り替える。 */
export const SCENE_COLORS = {
  skyTop: '#8fd0f0',
  skyBottom: '#d8eefb',
  farHill: '#9fb8a6',
  midHill: '#7fa389',
  field: '#b7d18a',
  fieldAlt: '#a3c477',
  building: '#c9c2b6',
  buildingDark: '#a8a094',
  roof: '#8a6f63',
  ballast: '#8d8478',
  sleeper: '#6b5a4a',
  rail: '#5a616b',
  railShine: '#9aa3ad',
  pole: '#6f7680',
  platform: '#d5d0c6',
  platformEdge: '#f0c040',
  platformSide: '#b3ada2',
  signPost: '#7c848f',
  signFace: '#f7f7f2',
  signBand: '#0072bc',
} as const;
