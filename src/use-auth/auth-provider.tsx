import * as React from 'react';
import { from } from 'rxjs';
import { useObservableSuspense, ObservableResource } from 'observable-hooks';
import find from 'lodash/find';
import { storeDBPromise } from '@wcpos/database/src/stores-db';
import { userDBResource, userResource, selectedResource } from './resources';

export const AuthContext = React.createContext<any>(null);

interface AuthProviderProps {
	children: React.ReactNode;
	initialProps: import('@wcpos/core/src/types').InitialProps;
}

/**
 *
 */
export const AuthProvider = ({ children, initialProps }: AuthProviderProps) => {
	const userDB = useObservableSuspense(userDBResource);
	const user = useObservableSuspense(userResource);
	const { site, wpCredentials, store } = useObservableSuspense(selectedResource);

	/**
	 *
	 */
	const login = React.useCallback(
		async ({ siteID, wpCredentialsID, storeID }) => {
			const current = await userDB.getLocal('current');
			await userDB.upsertLocal('current', {
				userID: current && current.get('userID'),
				siteID,
				wpCredentialsID,
				storeID,
			});
		},
		[userDB]
	);

	/**
	 *
	 */
	const logout = React.useCallback(async () => {
		const current = await userDB.getLocal('current');
		return userDB.upsertLocal('current', {
			userID: current && current.get('userID'),
		});
	}, [userDB]);

	/**
	 * site, wpCredentials, store is provided by initialProps, ie: WebApp
	 */
	React.useEffect(() => {
		const hydrateInitialProps = async (_site, wp_credentials, _store) => {
			let siteDoc;
			let wpCredentialsDoc;
			let storeDoc;

			/**
			 *
			 */
			const sites = await user.populate('sites').catch((err) => {
				console.error(err);
			});
			siteDoc = find(sites, { url: _site.url });

			// if not existingSite, then insert site data
			if (!siteDoc) {
				siteDoc = await userDB.sites.insert(_site);

				user.update({ $push: { sites: siteDoc?.localID } }).catch((err) => {
					console.log(err);
					return err;
				});
			}

			/**
			 *
			 */
			const wpCreds = await siteDoc.populate('wp_credentials').catch((err) => {
				console.error(err);
			});
			wpCredentialsDoc = find(wpCreds, { id: wp_credentials.id });

			// if not existingSite, then insert site data
			if (!wpCredentialsDoc) {
				wpCredentialsDoc = await userDB.wp_credentials.insert(wp_credentials);

				siteDoc.update({ $push: { wp_credentials: wpCredentialsDoc?.localID } }).catch((err) => {
					console.log(err);
					return err;
				});
			}

			/**
			 *
			 */
			const stores = await wpCredentialsDoc.populate('stores').catch((err) => {
				console.error(err);
			});
			storeDoc = find(stores, { id: _store.id });

			// if not existingSite, then insert site data
			if (!storeDoc) {
				storeDoc = await userDB.stores.insert(_store);

				wpCredentialsDoc.update({ $push: { stores: storeDoc?.localID } }).catch((err) => {
					console.log(err);
					return err;
				});
			}

			return login({
				siteID: siteDoc.localID,
				wpCredentialsID: wpCredentialsDoc.localID,
				storeID: storeDoc.localID,
			});
		};

		const { site: _site, wp_credentials, store: _store } = initialProps || {};
		if (_site && wp_credentials && _store) {
			hydrateInitialProps(_site, wp_credentials, _store);
		}
	}, [initialProps, login, user, userDB.sites, userDB.stores, userDB.wp_credentials]);

	/**
	 *
	 */
	const value = React.useMemo(() => {
		const storeDBResource =
			store?.localID && new ObservableResource(from(storeDBPromise(store.localID)));

		return {
			userDB,
			user,
			site,
			wpCredentials,
			store,
			login,
			logout,
			storeDBResource,
		};
	}, [userDB, login, logout, site, store, user, wpCredentials]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};