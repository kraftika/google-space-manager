import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config } from './config';
import authRoutes from './auth/routes';
import driveRoutes from './drive/routes';

const app = express();

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/api/drive', driveRoutes);

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
