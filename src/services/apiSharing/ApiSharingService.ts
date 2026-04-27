import {serverStore} from '../../store';
import {ModelStore} from '../../store/ModelStore';

class ApiSharingService {
  constructor(private modelStore: ModelStore) {}

  // API sharing functionality is currently disabled
  // This service will be implemented using a different approach in the future
  
  startServer(): void {
    // API sharing server: Service not implemented
  }

  stopServer(): void {
    // API sharing server: Service not implemented
  }

  updateServerStatus(): void {
    // API sharing status updated
  }
}

export default ApiSharingService;