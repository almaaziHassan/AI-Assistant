/**
 * Backward compatibility wrapper
 * Re-exports the refactored receptionist service from the new module structure
 * 
 * This file maintains backward compatibility with existing imports like:
 * import { ReceptionistService } from './services/receptionist'
 */

export {
  ReceptionistService,
  BookingConfirmation,
  CallbackConfirmation,
  ReceptionistResponse
} from './receptionist/index';
