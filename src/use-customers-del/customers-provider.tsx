import * as React from 'react';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { tap, switchMap, map, debounceTime } from 'rxjs/operators';
import { ObservableResource } from 'observable-hooks';
import useStore from '@wcpos/hooks/src/use-store';
import useOnlineStatus from '@wcpos/hooks/src/use-online-status';
import _map from 'lodash/map';
import _set from 'lodash/set';
import _get from 'lodash/get';
import _cloneDeep from 'lodash/cloneDeep';
import _forEach from 'lodash/forEach';
import useRestHttpClient from '../use-rest-http-client';
import { getAuditIdReplicationState } from './id-audit';
import { getReplicationState } from './replication';

type CustomerDocument = import('@wcpos/database/src/collections/customers').CustomerDocument;
type SortDirection = import('@wcpos/components/src/table/table').SortDirection;

export interface QueryState {
	// search?: Record<string, unknown>;
	search?: string;
	sortBy: string;
	sortDirection: SortDirection;
	filters?: Record<string, unknown>;
}

export const CustomersContext = React.createContext<{
	query$: BehaviorSubject<QueryState>;
	setQuery: (path: string | string[], value: any) => void;
	resource: ObservableResource<CustomerDocument[]>;
	runReplication: () => void;
}>(null);

interface CustomersProviderProps {
	children: React.ReactNode;
	initialQuery: QueryState;
}

const escape = (text: string) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

const replicationMap = new Map();

const CustomersProvider = ({ children, initialQuery }: CustomersProviderProps) => {
	const query$ = React.useMemo(() => new BehaviorSubject(initialQuery), [initialQuery]);
	const { storeDB } = useStore();
	const collection = storeDB.collections.customers;
	const http = useRestHttpClient();
	const { isConnected } = useOnlineStatus();

	/**
	 *
	 */
	const setQuery = React.useCallback(
		(path, value) => {
			const prev = _cloneDeep(query$.getValue());
			const next = _set(prev, path, value);
			query$.next(next);
		},
		[query$]
	);

	/**
	 *
	 */
	React.useEffect(() => {
		if (!isConnected) {
			replicationMap.forEach((replicationState) => {
				replicationState.then((result) => {
					result.cancel();
				});
			});
		}
	}, [isConnected]);

	/**
	 * Start replication
	 * - audit id (checks for deleted or new ids on server)
	 * - replication (syncs all data and checks for modified data)
	 */
	React.useEffect(() => {
		if (!replicationMap.get('audit')) {
			replicationMap.set('audit', getAuditIdReplicationState(http, collection));
		}

		if (!replicationMap.get('sync')) {
			replicationMap.set('sync', getReplicationState(http, collection));
		}

		return function cleanUp() {
			replicationMap.forEach((replicationState) => {
				replicationState.then((result) => {
					result.cancel();
				});
			});
		};
	}, [collection, http]);

	/**
	 *
	 */
	const sync = React.useCallback(() => {
		const audit = replicationMap.get('audit');

		if (audit) {
			audit.then((result) => {
				result.run();
			});
		}
	}, []);

	/**
	 *
	 */
	const customers$ = query$.pipe(
		// debounce hits to the local db
		debounceTime(100),
		// switchMap to the collection query
		switchMap((q) => {
			const selector = {};

			// const searchFields = ['username'];
			// if (q.search) {
			// 	selector.$or = searchFields.map((field) => ({
			// 		[field]: { $regex: new RegExp(escape(q.search), 'i') },
			// 	}));
			// }
			if (_get(q, 'search', '')) {
				_set(selector, ['username', '$regex'], new RegExp(escape(_get(q, 'search', '')), 'i'));
			}

			const RxQuery = collection.find({ selector });

			return RxQuery.$.pipe(
				// sort the results
				map((result) => result)
				// @ts-ignore
				// map((result) => {
				// 	const array = Array.isArray(result) ? result : [];
				// 	const productSorter = (product: any) => {
				// 		if (q.sortBy === 'name') {
				// 			// @TODO - this doens't work
				// 			return product[q.sortBy].toLowerCase();
				// 		}
				// 		return product[q.sortBy];
				// 	};
				// 	return orderBy(array, [productSorter], [q.sortDirection]);
				// })
			);
		})
	);

	const resource = React.useMemo(() => new ObservableResource(customers$), [customers$]);

	/**
	 *
	 */
	const value = React.useMemo(
		() => ({
			query$,
			// query: query$.getValue(),
			setQuery,
			resource,
			sync,
		}),
		[query$, resource, setQuery, sync]
	);

	return <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>;
};

export default CustomersProvider;