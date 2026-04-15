(function() {
    const roleFiles = [
        'roles/role_academic.js',
        'roles/role_brain_teaser.js',
        'roles/role_code_helper.js',
        'roles/role_english_partner.js',
        'roles/role_illustrator.js',
        'roles/role_interviewer.js',
        'roles/role_japanese_girl.js',
        'roles/role_math_olympiad.js',
        'roles/role_mayor.js',
        'roles/role_mistake_checker.js',
        'roles/role_persona_dialogue.js',
        'roles/role_tcm_master.js',
        'roles/role_translator.js',
        'roles/role_writer.js'
    ];
    const ROLE_READY_EVENT = 'roles:loaded';

    function normalizeRole(role) {
        if (!role || typeof role !== 'object') {
            return null;
        }

        const name = typeof role.name === 'string' ? role.name.trim() : '';
        if (!name) {
            return null;
        }

        const normalizedRole = Object.assign({}, role, {
            name,
            category: typeof role.category === 'string' && role.category.trim()
                ? role.category.trim()
                : '默认角色',
            guide: Array.isArray(role.guide)
                ? role.guide.filter(item => typeof item === 'string' && item.trim())
                : []
        });

        if (typeof normalizedRole.intro === 'string') {
            normalizedRole.intro = normalizedRole.intro.trim();
        }

        if (typeof normalizedRole.openingLine === 'string') {
            normalizedRole.openingLine = normalizedRole.openingLine.trim();
        }

        return normalizedRole;
    }

    function ensureRoleRegistry() {
        if (!Array.isArray(window.roles)) {
            window.roles = [];
        }

        window.registerRole = function(role) {
            const normalizedRole = normalizeRole(role);
            if (!normalizedRole) {
                return null;
            }

            const existingIndex = window.roles.findIndex(item => item && item.name === normalizedRole.name);
            if (existingIndex >= 0) {
                window.roles[existingIndex] = Object.assign({}, window.roles[existingIndex], normalizedRole);
                return window.roles[existingIndex];
            }

            window.roles.push(normalizedRole);
            return normalizedRole;
        };

        if (!window.getRoles) {
            window.getRoles = function() {
                return Array.isArray(window.roles) ? window.roles.slice() : [];
            };
        }

        window.roleReadyEventName = ROLE_READY_EVENT;
    }

    function loadRoleScript(path) {
        return new Promise(function(resolve, reject) {
            const script = _util.ce('script');
            script.src = path;
            script.async = false;
            script.onload = function() {
                resolve(path);
            };
            script.onerror = function() {
                reject(new Error('角色文件加载失败：' + path));
            };
            _util.ac(document.head, script);
        });
    }

    function notifyRolesLoaded() {
        window.dispatchEvent(new CustomEvent(ROLE_READY_EVENT, {
            detail: {
                roles: window.getRoles()
            }
        }));
    }

    function loadAllRoles() {
        ensureRoleRegistry();

        return roleFiles.reduce(function(chain, path) {
            return chain.then(function() {
                return loadRoleScript(path);
            });
        }, Promise.resolve()).then(function() {
            notifyRolesLoaded();
            return window.getRoles();
        }).catch(function(error) {
            console.error(error);
            notifyRolesLoaded();
            return window.getRoles();
        });
    }

    window.rolesReady = loadAllRoles();
})();
