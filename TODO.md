# To-Do List

![Important](https://img.shields.io/badge/Important-Red)
## Implement ssl
> for now use caddy as web server, so caddy will handle ssl

  kinda works tried with letsencrypt
  
auto configuration command is broken use copy pasting of the configuration

## Site Management

- [x] Create Site
- [x] Delete Site
- [x] List Sites
- [x] View Site Details
- [x] Site Health Check

## File Manager

- [x] Create file
- [x] Delete file
- [x] Rename file
- [x] Move file
- [ ] Copy file
- [x] extract
- [x] Create folder
- [x] Compress
- [x] Upload file
- [x] Download
- [x] Editor
- [x] Previewer

## Wordpress

- [x] Install plugin
- [x] Activate plugin
- [x] Deactivate plugin
- [x] Delete plugin
- [x] Update plugin
- [x] Install theme
- [x] Activate theme
- [x] Deactivate theme
- [x] Delete theme
- [x] Update theme
- [x] User listing
- [x] User creation
- [x] User deletion
- [x] User update
- [x] User password reset
- [x] User role assignment
- [x] User role update

## DNS

- [ ] Create DNS record
- [ ] Delete DNS record
- [ ] Update DNS record
- [ ] List DNS records
- [ ] Create DNS zone
- [ ] Delete DNS zone
- [ ] Update DNS zone
- [ ] List DNS zones
- [ ] domain connection wizard

## Databases

- [ ] Create Database
- [ ] Delete Database
- [ ] List Databases
- [ ] Create Database User
- [ ] Delete Database User
- [ ] List Database Users
- [ ] Update Database User Password

## TLS/SSL

- [x] Issue SSL Certificate (Let's Encrypt)
- [ ] View SSL status
- [ ] Upload custom certificate
- [x] Renew SSL Certificate

## Monitoring

- [x] View server metric
- [x] View site health
- [x] View background job status

## API

### Client API

- [x] API key auth (x-api-key + Bearer) for client routes
- [x] List accessible sites
- [x] Site details
- [x] Site health
- [x] Admin credentials fetch
- [x] Plugins (list/install/activate/deactivate/delete/update)
- [x] Themes (list/install/activate/enable/delete/update)
- [x] Users (list/create/update/roles/resetPassword/delete/listRoles)
- [x] File manager (list/read/write/create/rename/move/copy/delete/archive/extract/download/upload)
- [x] Postman collection: client-api.json

### Application API

- [x] Sites: create/update/delete
- [x] Sites: read/credentials/stats/sync/resize
- [x] Connectors: stats
- [x] Connectors: read/create/update/delete/configure
- [x] Locations: read/create/update/delete
- [x] Settings: read/update
- [x] Users: read/create/update/delete/ban/unban/resetPassword

#### Application API Spec (draft)

- Base: `/api/application`
- Auth: `Authorization` header (Bearer) or `x-api-key` (admin keys only)
- Responses: JSON, standard error shape `{ error, message, details? }`

Sites
- `GET /sites` list
- `POST /sites` create
- `GET /sites/{id}` read
- `PATCH /sites/{id}` update
- `DELETE /sites/{id}` delete
- `POST /sites/{id}/sync`
- `POST /sites/{id}/resize`
- `GET /sites/{id}/credentials`
- `GET /sites/{id}/stats`

Connectors
- `GET /connectors` list
- `POST /connectors` create
- `GET /connectors/{id}` read
- `PATCH /connectors/{id}` update
- `DELETE /connectors/{id}` delete
- `POST /connectors/{id}/configure`
- `GET /connectors/{id}/stats`

Locations
- `GET /locations` list
- `POST /locations` create
- `GET /locations/{id}` read
- `PATCH /locations/{id}` update
- `DELETE /locations/{id}` delete

Settings
- `GET /settings` read
- `PATCH /settings` update

Users
- `GET /users` list
- `POST /users` create
- `GET /users/{id}` read
- `PATCH /users/{id}` update
- `DELETE /users/{id}` delete
- `POST /users/{id}/ban`
- `POST /users/{id}/unban`
- `POST /users/{id}/reset-password`

## WHMCS

- [ ] plugin (require application api to be done)


## permission map for api route
sites`
  - `read` (site overview, install status)
  - `health` (health checks)
  - `credentials` (show admin password)
- `plugins`
  - `read`
  - `install`
  - `activate`
  - `deactivate`
  - `delete`
  - `update`
- `themes`
  - `read`
  - `install`
  - `activate`
  - `enable` (network enable)
  - `delete`
  - `update`
- `users`
  - `read` (list users)
  - `create`
  - `update`
  - `roles` (set roles/list roles)
  - `resetPassword`
  - `delete`
- `filemanager`
  - `read` (list/read)
  - `write` (write/create)
  - `upload`
  - `delete`
  - `rename`
  - `move`
  - `copy`
  - `archive` (compress)
  - `extract`
  - `download` (file download / zip download)
