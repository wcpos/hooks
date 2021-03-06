import * as React from 'react';
import { ObservableResource } from 'observable-hooks';
import { map } from 'rxjs/operators';
import useRestHttpClient from '../use-rest-http-client';
import useAppState from '../use-app-state';

interface State {
	code: string;
	name: string;
}

export interface Country {
	code: string;
	name: string;
	states: State[];
}

/**
 *
 */
export const useCountryResource = (): ObservableResource<Country[]> => {
	const http = useRestHttpClient();
	const { storeDB } = useAppState();

	const fetchAndSaveCountries = React.useCallback(async () => {
		const { data } = await http.get('data/countries');
		if (data) {
			storeDB.insertLocal('countries', data);
		}
	}, [http, storeDB]);

	const resource = React.useMemo(
		() =>
			new ObservableResource(
				storeDB.getLocal$('countries').pipe(
					map((result) => {
						if (result) {
							return result.toJSON();
						}
						fetchAndSaveCountries();
						return [];
					})
				)
			),
		[fetchAndSaveCountries, storeDB]
	);

	return resource;
};
