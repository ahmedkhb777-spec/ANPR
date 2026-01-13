
export enum VehicleType {
  PRIVATE = 'PRIVATE',
  TAXI = 'TAXI',
  POLICE = 'POLICE',
  AMBULANCE = 'AMBULANCE',
  OTHER = 'OTHER'
}

export type Language = 'ar' | 'en';

export interface RecognitionResult {
  plateNumber: string;
  letter: string;
  city: string;
  vehicleType: VehicleType;
  country: string;
  confidence: number;
}

export interface ProcessedItem {
  id: string;
  fileName: string;
  image: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result: RecognitionResult | null;
  error: string | null;
}

export interface AppState {
  items: ProcessedItem[];
  isGlobalLoading: boolean;
  language: Language;
}
