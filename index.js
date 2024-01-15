// Intern variables
const TOKEN = 'iM65vvcmBTMkj8oqjT5RxFP70TUf5EqWdW6YWpRdUJk';
const LIMIT = '80';

const REQUEST_OPTIONS = {
	method: 'GET',
	mode: 'cors',
	cache: 'default',
	credentials: 'same-origin',
	headers: {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${TOKEN}`,
	},
};

// Generated variables
let account = null;
let instance = '';
let followings = [];

// Helping functions
function normalizeAccount(account = null, otherProperties = null) {
	try {
		if (!account) throw new Error('Invalid account!');

		const { id, acct, display_name, avatar } = account;
		const normalizedAccount = {
			id,
			acct,
			display_name,
			avatar,
			...otherProperties,
		};

		return normalizedAccount;
	} catch (error) {
		throw error;
	}
}

async function getAccounts(initialUrl = '') {
	try {
		if (!initialUrl) throw new Error('Invalid URL!');

		const accountAccumulator = [];
		let url = initialUrl;

		let match = null;

		do {
			console.log(url);

			match = null;

			// Get account and add it to accumulator
			const response = await fetch(url, REQUEST_OPTIONS);
			if (!response.ok) throw new Error('Error fetching accounts!');

			const accounts = await response.json();

			for (const account of accounts) {
				const normalizedAccount = normalizeAccount(account);
				accountAccumulator.push(normalizedAccount);
			}

			// Check if there are new accounts to fetch
			const link = response.headers.get('link');
			if (link === null) continue;

			match = link.match(/<([^>]+)>; rel="next"/);
			if (match === null) continue;

			url = match[1];
		} while (match !== null);

		return accountAccumulator;
	} catch (error) {
		throw error;
	}
}

// Direcly used function
async function getAccountAndInstanceByHandle(handle = '') {
	try {
		const regex =
			/^[a-zA-Z0-9.!#$%&'*+\=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

		if (!handle.match(regex)) throw new Error('Ivalid Handle!');

		const [username, instance] = handle.split('@');
		const url = `https://${instance}/api/v1/accounts/lookup?acct=${username}`;
		const response = await fetch(url, REQUEST_OPTIONS);
		if (!response.ok) throw new Error('Error fetching accounts!');

		const account = await response.json();
		const normalizedAccount = normalizeAccount(account);

		return [instance, normalizedAccount];
	} catch (error) {
		throw error;
	}
}

async function getFollowings(account = null) {
	try {
		if (!account) throw new Error('Invalid account!');

		// Get followings
		const accountId = account.id;
		const url = `https://${instance}/api/v1/accounts/${accountId}/following?limit=${LIMIT}`;
		let followings = await getAccounts(url);

		// Normalize followings
		followings = followings.map(following =>
			normalizeAccount(following, { show: true })
		);

		return followings;
	} catch (error) {
		throw error;
	}
}

async function getFollowingFollowers(followings = []) {
	try {
		if (!followings || !followings.length) throw new Error('Invalid accounts!');

		const followingsId = followings.map(following => following.id);
		const followingFollowersAccumulator = [];

		// Retrieve all accounts that are following the accounts followed by the user.
		for (const followingId of followingsId) {
			const url = `https://${instance}/api/v1/accounts/${followingId}/followers?limit=${LIMIT}`;
			let followingFollowers = await getAccounts(url);

			followingFollowers = followingFollowers.map(followingFollower =>
				normalizeAccount(followingFollower, { following: followingId })
			);

			followingFollowersAccumulator.push(...followingFollowers);
		}

		// Unify repeated accounts
		const uniquefollowingFollowers = followingFollowersAccumulator
			.reduce((accumulator, follower, _, array) => {
				// Remove user's or repeated accounts
				if (
					follower.id === account.id ||
					accumulator.some(element => element.id === follower.id)
				)
					return accumulator;

				// Group following by follower
				const followings = array
					.filter(followingFollower => followingFollower.id === follower.id)
					.map(followingFollower => followingFollower.following);

				accumulator.push({ ...follower, followings });

				return accumulator;
			}, [])
			.sort((a, b) => b.following.length - a.following.length);

		return uniquefollowingFollowers;
	} catch (error) {
		throw error;
	}
}

async function getFollowingFollowerFollowings(followingFollowers = []) {
	if (!followingFollowers || !followingFollowers.length)
		throw new Error('Invalid accounts!');

	const followingFollowersId = followingFollowers.map(
		followingFollower => followingFollower.id
	);
	const followingFollowerFollowingsAccumulator = [];

	// Retrieve all accounts followed by users who follow the same accounts as the user.
	for (const followingFollowerId of followingFollowersId) {
		const url = `https://${instance}/api/v1/accounts/${followingFollowerId}/following?limit=${LIMIT}`;
		let followingFollowerFollowings = await getAccounts(url);

		followingFollowerFollowings = followingFollowerFollowings.map(
			followingFollowerFollowing =>
				normalizeAccount(followingFollowerFollowing, {
					follower: followingFollowerId,
				})
		);

		followingFollowerFollowingsAccumulator.push(...followingFollowerFollowings);
	}

	// Unify Repeated Accounts
	const unifiedFollowingFollowerFollowings =
		followingFollowerFollowingsAccumulator
			.reduce((accumulator, followerFollowings, _, array) => {
				if (
					followings.some(
						following => following.id === followerFollowings.id
					) ||
					accumulator.some(element => element.id === followerFollowings.id) ||
					followerFollowings.id === account.id
				)
					return accumulator;

				const followers = array
					.filter(
						followingFollowerFollowing =>
							followingFollowerFollowing.id === followerFollowings.id
					)
					.map(
						followingFollowerFollowing => followingFollowerFollowing.follower
					);

				accumulator.push({ ...followerFollowings, followers });

				return accumulator;
			}, [])
			.sort((a, b) => b.followers.length - a.followers.length)
			.slice(0, 50);

	return unifiedFollowingFollowerFollowings;
}

async function main() {
	try {
		handle = 'cassiogomes00@techhub.social';

		// Retrieve the user's account
		[instance, account] = await getAccountAndInstanceByHandle(handle);
		console.log('Instance: ' + instance);
		console.log('Account:');
		console.log(account);

		// Retrieve the accounts followed by the user
		followings = await getFollowings(account);
		console.log(followings);
		console.log('Followings: ' + followings.length);

		// Retrieve the followers of the accounts followed by the user
		const followingFollowers = await getFollowingFollowers(followings);
		console.log(followingFollowers);
		console.log('Following Followers: ' + followingFollowers.length);

		// Retrieve the accounts followed by the followers of the user's followings
		const followingFollowerFollowings = await getFollowingFollowerFollowings(
			followingFollowers
		);
		console.log(followingFollowerFollowings);
		console.log(
			'Following Follower Followings: ' + followingFollowerFollowings.length
		);
	} catch (error) {
		console.log(error);
	}
}

main();
