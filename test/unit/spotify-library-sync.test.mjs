import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

test('1. Spotify PKCE Scopes include all required user data permissions', () => {
  const { NG } = loadAppInstance();
  const scopes = NG.providers.SPOTIFY_SCOPES.split(' ');
  const requiredScopes = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-follow-read',
    'user-top-read',
    'user-read-recently-played',
    'user-read-currently-playing'
  ];

  for (const s of requiredScopes) {
    assert.ok(scopes.includes(s), `Missing required scope: ${s}`);
  }
});

test('2. PKCE Authorization URL generation properly configures code_challenge and state', async () => {
  const { NG, localStorage, context } = loadAppInstance();
  const sessionStorage = context.sessionStorage;

  const authUrlStr = await NG.providers.connectSpotify(
    'test_spotify_client_id_123',
    'http://127.0.0.1:3000/callback'
  );

  const authUrl = new URL(authUrlStr);
  assert.equal(authUrl.origin, 'https://accounts.spotify.com');
  assert.equal(authUrl.pathname, '/authorize');
  assert.equal(authUrl.searchParams.get('client_id'), 'test_spotify_client_id_123');
  assert.equal(authUrl.searchParams.get('response_type'), 'code');
  assert.equal(authUrl.searchParams.get('redirect_uri'), 'http://127.0.0.1:3000/callback');
  assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256');

  const challenge = authUrl.searchParams.get('code_challenge');
  const state = authUrl.searchParams.get('state');
  assert.ok(challenge && challenge.length > 20, 'code_challenge must be generated');
  assert.ok(state && state.length > 5, 'state parameter must be generated');

  // Verify verifier was saved in storage
  const savedVerifier = sessionStorage.getItem('spotify_pkce_verifier') || localStorage.getItem('spotify_pkce_verifier');
  assert.ok(savedVerifier, 'code_verifier must be persisted for PKCE code exchange');
});

test('3. Token Management: automatically refreshes token before expiration', async () => {
  let refreshCalled = false;
  const mockFetch = async (url, opts) => {
    if (url === 'https://accounts.spotify.com/api/token') {
      refreshCalled = true;
      return {
        ok: true,
        json: async () => ({
          access_token: 'new_refreshed_access_token_999',
          refresh_token: 'new_refresh_token_888',
          expires_in: 3600
        })
      };
    }
    return { ok: false };
  };

  const initialAuth = {
    accessToken: 'old_expired_token',
    refreshToken: 'valid_refresh_token',
    expiresAt: Date.now() - 5000, // already expired
    user: { id: 'test_user', product: 'free' }
  };

  const { NG, localStorage } = loadAppInstance({
    'nagham_spotify_auth': JSON.stringify(initialAuth),
    'nagham_spotify_client_id': 'test_client_id'
  }, { fetch: mockFetch });

  const token = await NG.providers.getValidAccessToken();
  assert.equal(refreshCalled, true, 'Token refresh endpoint must be invoked when token is expired');
  assert.equal(token, 'new_refreshed_access_token_999');

  const updatedAuth = JSON.parse(localStorage.getItem('nagham_spotify_auth'));
  assert.equal(updatedAuth.accessToken, 'new_refreshed_access_token_999');
  assert.equal(updatedAuth.refreshToken, 'new_refresh_token_888');
  assert.ok(updatedAuth.expiresAt > Date.now());
});

test('4. mapSpotifyTrackTo7ify converts Spotify Web API item to 7ify track schema', () => {
  const { NG } = loadAppInstance();
  const rawSpotifyTrack = {
    id: '4cOdK2wGLETKBW3PvgPWqT',
    name: 'Wish I Never Met You',
    uri: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
    duration_ms: 215432,
    explicit: true,
    artists: [{ id: 'art1', name: 'Tory Lanez' }],
    album: {
      id: 'alb1',
      name: 'Prison Tapes',
      release_date: '2024-07-26',
      images: [
        { url: 'https://i.scdn.co/image/art_large.jpg', height: 640, width: 640 },
        { url: 'https://i.scdn.co/image/art_med.jpg', height: 300, width: 300 }
      ]
    },
    external_urls: {
      spotify: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'
    }
  };

  const tr = NG.mapSpotifyTrackTo7ify(rawSpotifyTrack);
  assert.equal(tr.id, 'sp-4cOdK2wGLETKBW3PvgPWqT');
  assert.equal(tr.spotifyId, '4cOdK2wGLETKBW3PvgPWqT');
  assert.equal(tr.spotifyUri, 'spotify:track:4cOdK2wGLETKBW3PvgPWqT');
  assert.equal(tr.title.ar, 'Wish I Never Met You');
  assert.equal(tr.artist.ar, 'Tory Lanez');
  assert.equal(tr.album.ar, 'Prison Tapes');
  assert.equal(tr.art, 'https://i.scdn.co/image/art_large.jpg');
  assert.equal(tr.duration, 215);
  assert.equal(tr.fullDuration, 215);
  assert.equal(tr.year, 2024);
  assert.equal(tr.source, 'spotify');
  assert.equal(tr.isExplicit, true);
});

test('5. Full Library Sync mirrors user profile, liked songs, playlists, artists, and albums', async () => {
  const mockFetch = async (url, opts) => {
    // 1. Profile
    if (url === 'https://api.spotify.com/v1/me') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'spotify_user_42',
          display_name: 'Hussam',
          email: 'hussam@example.com',
          product: 'premium',
          images: [{ url: 'https://i.scdn.co/avatar.jpg' }],
          followers: { total: 184 },
          country: 'EG'
        })
      };
    }

    // 2. Liked Songs (Page 1 with next link)
    if (url === 'https://api.spotify.com/v1/me/tracks?limit=50') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              track: {
                id: 'liked_1',
                name: 'Song One',
                artists: [{ name: 'Artist A' }],
                album: { name: 'Album A', images: [{ url: 'https://i.scdn.co/alb1.jpg' }] },
                duration_ms: 180000
              }
            }
          ],
          next: 'https://api.spotify.com/v1/me/tracks?offset=50&limit=50'
        })
      };
    }
    if (url === 'https://api.spotify.com/v1/me/tracks?offset=50&limit=50') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              track: {
                id: 'liked_2',
                name: 'Song Two',
                artists: [{ name: 'Artist B' }],
                album: { name: 'Album B', images: [{ url: 'https://i.scdn.co/alb2.jpg' }] },
                duration_ms: 200000
              }
            }
          ],
          next: null
        })
      };
    }

    // 3. Playlists
    if (url === 'https://api.spotify.com/v1/me/playlists?limit=50') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'pl_sp_1',
              name: 'My Spotify Favorites',
              description: 'Best tunes',
              images: [{ url: 'https://i.scdn.co/pl1.jpg' }],
              owner: { display_name: 'Hussam' }
            }
          ],
          next: null
        })
      };
    }

    // 4. Playlist Tracks
    if (url.includes('/playlists/pl_sp_1/tracks')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              track: {
                id: 'pl_track_1',
                name: 'Playlist Song 1',
                artists: [{ name: 'Band X' }],
                album: { name: 'Album X', images: [{ url: 'https://i.scdn.co/albX.jpg' }] },
                duration_ms: 220000
              }
            }
          ],
          next: null
        })
      };
    }

    // 5. Followed Artists
    if (url.includes('/me/following?type=artist')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          artists: {
            items: [
              {
                id: 'artist_fav_1',
                name: 'Tory Lanez',
                images: [{ url: 'https://i.scdn.co/tory.jpg' }],
                followers: { total: 12500000 }
              }
            ],
            next: null
          }
        })
      };
    }

    // 6. Saved Albums
    if (url === 'https://api.spotify.com/v1/me/albums?limit=50') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              album: {
                id: 'alb_fav_1',
                name: 'Alone At Prom',
                artists: [{ name: 'Tory Lanez' }],
                images: [{ url: 'https://i.scdn.co/alone.jpg' }],
                release_date: '2021-12-10',
                tracks: { items: [] }
              }
            }
          ],
          next: null
        })
      };
    }

    // 7. Recently Played
    if (url.includes('/me/player/recently-played')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              track: {
                id: 'rec_1',
                name: 'The Color Violet',
                artists: [{ name: 'Tory Lanez' }],
                album: { name: 'Alone At Prom', images: [{ url: 'https://i.scdn.co/alone.jpg' }] },
                duration_ms: 226000
              },
              played_at: '2026-11-07T17:00:00Z'
            }
          ]
        })
      };
    }

    // 8. Top Tracks
    if (url.includes('/me/top/tracks')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'top_1',
              name: 'Ballad of a Bad Girl',
              artists: [{ name: 'Tory Lanez' }],
              album: { name: 'Alone At Prom', images: [{ url: 'https://i.scdn.co/alone.jpg' }] },
              duration_ms: 198000
            }
          ]
        })
      };
    }

    // 9. Top Artists
    if (url.includes('/me/top/artists')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'top_art_1',
              name: 'The Weeknd',
              images: [{ url: 'https://i.scdn.co/weeknd.jpg' }],
              followers: { total: 85000000 }
            }
          ]
        })
      };
    }

    // 10. Currently Playing (204 No Content)
    if (url.includes('/me/player/currently-playing')) {
      return {
        ok: true,
        status: 204
      };
    }

    return { ok: false, status: 404 };
  };

  const initialAuth = {
    accessToken: 'valid_test_token',
    expiresAt: Date.now() + 3600000,
    user: { id: 'old_user' }
  };

  const { NG, state, TRACKS, localStorage } = loadAppInstance({
    'nagham_spotify_auth': JSON.stringify(initialAuth)
  }, { fetch: mockFetch });

  // Run library sync
  const progressLogs = [];
  const result = await NG.providers.syncSpotifyLibrary((p) => {
    progressLogs.push(p.stage);
  });

  // Verify stages were executed
  assert.ok(progressLogs.includes('profile'));
  assert.ok(progressLogs.includes('liked'));
  assert.ok(progressLogs.includes('playlists'));
  assert.ok(progressLogs.includes('artists'));
  assert.ok(progressLogs.includes('albums'));
  assert.ok(progressLogs.includes('recently_played'));
  assert.ok(progressLogs.includes('top'));
  assert.ok(progressLogs.includes('done'));

  // Verify liked songs added to state.favorites and TRACKS
  assert.ok(state.favorites.includes('sp-liked_1'));
  assert.ok(state.favorites.includes('sp-liked_2'));
  const track1 = NG.getTrack('sp-liked_1');
  assert.ok(track1, 'Track 1 must be resolvable via getTrack()');
  assert.equal(track1.title.ar, 'Song One');

  // Verify playlists synced to state.playlists
  const spPl = state.playlists.find(p => p.id === 'sp-pl-pl_sp_1');
  assert.ok(spPl, 'Spotify playlist must be added to state.playlists');
  assert.equal(spPl.name.ar, 'My Spotify Favorites');
  assert.equal(spPl.isSpotify, true);
  assert.deepEqual(Array.from(spPl.trackIds), ['sp-pl_track_1']);

  // Verify library cache in localStorage
  const libCache = JSON.parse(localStorage.getItem('nagham_spotify_library'));
  assert.ok(libCache, 'Library must be cached in localStorage');
  assert.equal(libCache.profile.display_name, 'Hussam');
  assert.equal(libCache.followedArtists.length, 1);
  assert.equal(libCache.savedAlbums.length, 1);
  assert.equal(libCache.topTracks.length, 1);
  assert.equal(libCache.topArtists.length, 1);
  assert.equal(libCache.recentlyPlayed.length, 1);

  // Test currently playing 204 No Content
  const curr = await NG.providers.spotifyApi.getCurrentlyPlaying();
  assert.equal(curr, null, 'Currently playing must return null on HTTP 204 No Content');
});

test('6. Rehydration on restart restores cached Spotify tracks and playlists without sync', () => {
  const cachedLibrary = {
    lastSyncedAt: Date.now(),
    profile: { id: 'user_rehydrate', display_name: 'Rehydrated User' },
    likedTrackIds: ['sp-rehydrated_1'],
    playlists: [
      {
        id: 'sp-pl-rehydrated',
        name: { ar: 'Rehydrated Playlist', en: 'Rehydrated Playlist' },
        sub: { ar: '', en: '' },
        trackIds: ['sp-rehydrated_1'],
        colors: ['#121212', '#1f1f1f', '#1ed760'],
        motif: 'rings',
        isSpotify: true
      }
    ],
    topTracks: [
      {
        id: 'sp-rehydrated_1',
        title: { ar: 'Rehydrated Track', en: 'Rehydrated Track' },
        artist: { ar: 'Artist R', en: 'Artist R' },
        album: { ar: 'Album R', en: 'Album R' },
        duration: 195,
        source: 'spotify'
      }
    ],
    recentlyPlayed: []
  };

  const { NG, state, TRACKS } = loadAppInstance({
    'nagham_spotify_library': JSON.stringify(cachedLibrary)
  });

  // Rehydration must restore the track into TRACKS
  const tr = NG.getTrack('sp-rehydrated_1');
  assert.ok(tr, 'Cached track must be rehydrated into TRACKS');
  assert.equal(tr.title.ar, 'Rehydrated Track');

  // Rehydration must restore playlist into state.playlists
  const pl = state.playlists.find(p => p.id === 'sp-pl-rehydrated');
  assert.ok(pl, 'Cached playlist must be restored in state.playlists');
});

test('7. Brand Integrity: Zero forbidden words in newly added user-facing strings', () => {
  const { NG } = loadAppInstance();
  const arStrings = Object.values(NG.I18N.ar).join(' ').toLowerCase();

  const forbiddenWords = ['سيرفر', '30 ثانية', '٣٠ ثانية', 'apple', 'youtube'];
  for (const word of forbiddenWords) {
    // Specifically test our new profile keys
    const profileKeys = Object.keys(NG.I18N.ar).filter(k => k.startsWith('profile.'));
    for (const pk of profileKeys) {
      const val = NG.I18N.ar[pk].toLowerCase();
      assert.equal(
        val.includes(word.toLowerCase()),
        false,
        `Forbidden word "${word}" found in I18N key "${pk}": "${NG.I18N.ar[pk]}"`
      );
    }
  }
});
