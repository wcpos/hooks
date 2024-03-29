import * as React from 'react';

import { isCancel } from 'axios';
import get from 'lodash/get';

import useSnackbar from '@wcpos/components/src/snackbar';
import log from '@wcpos/utils/src/logger';

type AxiosResponse = import('axios').AxiosResponse;
type AxiosError = import('axios').AxiosError;

/**
 *
 */
const useHttpErrorHandler = () => {
	const addSnackbar = useSnackbar();

	/**
	 *
	 */
	const errorResponseHandler = React.useCallback(
		(res: AxiosResponse) => {
			if (!res) {
				return;
			}

			switch (res.status) {
				case 0:
					/**
					 * This can happen for self-signed certificates, eg: development servers
					 * The solution for web is to go to the site and manually trust the certificate
					 * TODO - what happens on desktop and mobile?
					 *
					 * status = 0
					 */
					addSnackbar({ message: 'Domain is invalid' });
					break;
				case 400:
					addSnackbar({ message: res.data.message });
					break;
				case 401:
					if (res.data) {
						/**
						 * TODO - Errors may be better in a global Dialog component, like Snackbar?
						 */
						addSnackbar({
							message: `Recieved "${res.data.message}" when trying to access endpoint: ${res.config.url}`,
							// type: 'critical',
						});
					}
					break;
				case 403:
					if (res.data) {
						/**
						 * TODO - Errors may be better in a global Dialog component, like Snackbar?
						 */
						addSnackbar({
							message: `Recieved "${res.data.message}" when trying to access endpoint: ${res.config.url}`,
							// type: 'critical',
						});
					} else {
						addSnackbar({
							message: `Recieved "Forbidden" when trying to access endpoint: ${res.config.url}`,
							// type: 'critical',
						});
					}
					break;
				case 404:
					if (res.data) {
						addSnackbar({
							message: res.data.message,
							// type: 'critical',
						});
					}
					log.error('404 error', res);
					break;
				case 500:
					log.error('500 Internal server error', res);
					break;
				default:
					log.error('Unknown error', res);
			}
		},
		[addSnackbar]
	);

	/**
	 *
	 */
	const errorHandler = React.useCallback(
		(error: unknown) => {
			const response = get(error, 'response');
			const request = get(error, 'request');

			if (response) {
				// client received an error response (5xx, 4xx)
				errorResponseHandler(response);
			} else if (request) {
				// client never received a response, or request never left
				log.error(request);
				addSnackbar({ message: 'Server is unavailable' });
			} else if (isCancel(error)) {
				// handle cancel
				log.info('Request canceled');
			} else {
				// anything else
				log.error(error);
				addSnackbar({ message: 'Network error' });
			}
		},
		[addSnackbar, errorResponseHandler]
	);

	return errorHandler;
};

export default useHttpErrorHandler;
