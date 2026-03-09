// 动态加载roles目录下所有角色js
function loadAllRoles() {
    // 可根据实际情况维护角色文件名列表，或后续用后端接口/manifest自动生成
    const roleFiles = [
        'roles/role_academic.js',
        'roles/role_brain_teaser.js',
        'roles/role_code_helper.js',
        'roles/role_english_partner.js',
        'roles/role_illustrator.js',
        'roles/role_interviewer.js',
        'roles/role_math_olympiad.js',
        'roles/role_mistake_checker.js',
        'roles/role_translator.js',
        'roles/role_writer.js'
    ];
    roleFiles.forEach(function(path) {
        const script = document.createElement('script');
        script.src = path;
        script.async = false;
        document.head.appendChild(script);
    });
}
loadAllRoles();