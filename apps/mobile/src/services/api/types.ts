export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'http_client_error'
  | 'http_server_error'
  | 'invalid_response';

export interface HealthResponse {
  status: string;
}
