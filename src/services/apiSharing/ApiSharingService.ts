import {serverStore} from '../../store';
import {ModelStore} from '../../store/ModelStore';

class ApiSharingService {
  constructor(private modelStore: ModelStore) {}

  // API sharing functionality is currently disabled
  // This service will be implemented using a different approach in the future
  
  startServer(): void {
    console.log('API Sharing server: Service not implemented');
  }

  stopServer(): void {
    console.log('API Sharing server: Service not implemented');
  }

  updateServerStatus(): void {
    if (serverStore.apiSharingEnabled) {
      console.log('API Sharing enabled: Service not implemented');
    } else {
      console.log('API Sharing disabled');
    }
  }
}

export default ApiSharingService;