import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin esto, los componentes de un test siguen montados en el siguiente y los
// queries encuentran dos coincidencias donde debería haber una.
afterEach(cleanup);
