/**
 * NexusChat — Enterprise v4
 * Full Slack-standard logic + Jira Tasks + Real-time simulate + Media Lightbox + Screen Sharing
 */
(function () {
    'use strict';

    // ========== CONSTANTS & MOCKS ==========
    const S = {
        get: function(k, fb) { 
            try { 
                var v = localStorage.getItem('nx_' + k); 
                return v ? JSON.parse(v) : fb; 
            } catch(e) { return fb; } 
        },
        set: function(k, v) { localStorage.setItem('nx_' + k, JSON.stringify(v)); },
        del: function(k) { localStorage.removeItem('nx_' + k); }
    };

    const EMOJI_CATEGORIES = {
        smileys: '😀,😃,😄,😁,😆,😅,🤣,😂,🙂,😊,😇,🥰,😍,🤩,😘,😗,😚,😋,😛,😜,🤪,😝,🤑,🤗,🤭,🤫,🤔,🤐,🤨,😐,😑,😶,😏,😒,🙄,😬,😌,😔,😪,😴,😷,🤒,🤕,🤢,🤮,🥵,🥶,🥴,😵,🤯,🤠,🥳,😎,🤓,🧐,😕,😟,🙁,😮,😯,😲,😳,🥺,😦,😧,😨,😰,😥,😢,😭,😱,😖,😣,😞,😓,😩,😫,🥱,😤,😡,😠,🤬,😈,👿,💀,☠️,💩,🤡,👹,👺,👻,👽,👾,🤖'.split(','),
        people: '👋,🤚,🖐️,✋,🖖,👌,🤌,🤏,✌️,🤞,🤟,🤘,🤙,👈,👉,👆,🖕,👇,☝️,👍,👎,✊,👊,🤛,🤜,👏,🙌,👐,🤲,🤝,🙏,💪,🦾,👂,👃,👀,👅,👄,💅'.split(','),
        nature: '🌿,🍀,🍁,🍂,🍃,🌺,🌻,🌹,🌷,🌸,💐,🌵,🌲,🌳,🌴,🐶,🐱,🐭,🐹,🐰,🦊,🐻,🐼,🐨,🐯,🦁,🐮,🐷,🐸,🐵,🐔,🐧,🐦,🦆,🦅,🦉,🐺,🐴,🦄'.split(','),
        objects: '💡,🔦,📱,💻,⌨️,🖥️,💾,📷,📹,🔍,🔬,📺,📻,⏰,💰,💳,💎,🔧,🔨,🔩,⚙️,🔑,📦,📫,📬,📭,📮'.split(','),
        symbols: '❤️,🧡,💛,💚,💙,💜,🖤,🤍,🤎,💔,❣️,💕,💞,💓,💗,💖,💘,💝,💟,☮️,✝,☪,🕉,☸,✡,🔯,✴️,🆚,💮,🉐,㊗️,🈴,🈵,🈹,🈲,🅰️,🅱️,🆎,🅾️,🆘'.split(',')
    };

    // ========== UTILS ==========
    const esc = function(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    const initials = function(f, l) { return ((f?f[0]:'')+(l?l[0]:'')).toUpperCase(); };
    const fullName = function(u) { return u ? u.firstName + ' ' + u.lastName : 'Unknown User'; };
    const timeNow = function() { return new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}); };
    const dateNow = function() { return new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); };
    const fmtSize = function(b) { return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB'; };

    const toast = function(msg, type) {
        type = type || 'success';
        var c = document.querySelector('.toast-container');
        if (!c) { c = document.createElement('div'); c.className='toast-container'; document.body.appendChild(c); }
        var t = document.createElement('div'); t.className='toast toast--' + type; t.textContent=msg; c.appendChild(t);
        setTimeout(function(){ t.style.animation='toastOut 0.3s ease forwards'; setTimeout(function(){t.remove();},300); },3000);
    };

    const openModal = function(id) { 
        var el = document.getElementById(id);
        if(el) el.classList.add('modal-overlay--active'); 
    };
    const closeModal = function(id) { 
        var el = document.getElementById(id);
        if(el) el.classList.remove('modal-overlay--active'); 
    };

    const getAllUsers = function() { return S.get('users', []); };
    const getUserById = function(id) { 
        var users = getAllUsers();
        for(var i=0; i<users.length; i++) { if(users[i].id === id) return users[i]; }
        return null;
    };

    // ========== APP CORE ==========
    const NexusApp = {
        user: null, channels: [], messages: {}, dms: {}, tasks: [], activeConvo: null,
        pendingFiles: [], stream: null, timer: null, secs: 0, currentTask: null, inbox: [],

        init: function() {
            this.user = S.get('currentUser');
            if (!this.user) { Auth.init(); return; }

            this.channels = S.get('channels', [{id:'general',name:'general',members:[this.user.id],description:'Company-wide announcements'}]);
            this.messages = S.get('messages', {});
            this.tasks = S.get('tasks', []);
            this.dms = S.get('dms_'+this.user.id, []);
            this.inbox = S.get('inbox_'+this.user.id, []);

            var authS = document.getElementById('auth-screen'); if(authS) authS.style.display='none';
            var appS = document.getElementById('app'); if(appS) appS.style.display='flex';

            this.renderSidebar();
            this.renderMembers();
            this.renderTasks();
            this.renderDashboard();
            this.bindEvents();
            this.bindGlobalSearch();
            this.bindMobile();
        },

        save: function(k) { S.set(k==='dms'?'dms_'+this.user.id:k==='inbox'?'inbox_'+this.user.id:k, this[k]); },

        renderDashboard: function() {
            var wt = document.getElementById('welcome-title');
            if (wt) wt.textContent = 'Welcome back, ' + this.user.firstName + '!';
            var dt = document.getElementById('dashboard-time');
            if (dt) {
                var now = new Date();
                var h = now.getHours();
                var greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
                dt.textContent = greeting + ' • ' + dateNow() + ' ' + timeNow();
            }
            var ws = document.getElementById('welcome-subtitle');
            if (ws) {
                var openCount = this.tasks.filter(function(t){ return t.column !== 'done'; }).length;
                ws.textContent = openCount > 0 ? 'You have ' + openCount + ' open task' + (openCount>1?'s':'') + ' and ' + this.channels.length + ' active channel' + (this.channels.length>1?'s':'') + '.' : 'All clear! No pending tasks right now.';
            }
            // Stats
            var sc = document.getElementById('stat-channels'); if(sc) sc.textContent = this.channels.length;
            var st = document.getElementById('stat-tasks'); if(st) st.textContent = this.tasks.filter(function(t){return t.column!=='done';}).length;
            var sm = document.getElementById('stat-members'); if(sm) sm.textContent = getAllUsers().length;
            var sd = document.getElementById('stat-done'); if(sd) sd.textContent = this.tasks.filter(function(t){return t.column==='done';}).length;
            
            this.renderDashTasks();
            this.renderDashComms();
            this.renderInbox();
        },

        renderDashTasks: function() {
            var c = document.getElementById('dash-my-tasks'); if(!c) return;
            c.innerHTML = '';
            var myTasks = this.tasks.filter(function(t) { return t.assigneeId === this.user.id; }.bind(this));
            if(!myTasks.length) { c.innerHTML = '<p style="font-size:0.8rem;color:var(--text-tertiary)">No tasks assigned to you yet.</p>'; return; }
            var self = this;
            myTasks.forEach(function(t) {
                var el = document.createElement('div'); el.className = 'dash-task-item';
                el.innerHTML = '<div><span style="font-weight:600;font-size:0.85rem;display:block">'+esc(t.title)+'</span><span class="tag tag--'+t.priority+'">'+t.priority+'</span></div><span class="column-count">'+t.column+'</span>';
                el.onclick = function() { self.openTaskDetail(t.id); };
                c.appendChild(el);
            });
        },

        renderDashComms: function() {
            var c = document.getElementById('dash-my-comms'); if(!c) return;
            c.innerHTML = '';
            var self = this;
            var myChannels = this.channels.filter(function(ch){ return ch.members && ch.members.indexOf(self.user.id) > -1; });
            myChannels.slice(0, 3).forEach(function(ch) {
                var el = document.createElement('div'); el.className = 'dash-task-item';
                el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><span class="channel-hash">#</span><span style="font-size:0.85rem">'+esc(ch.name)+'</span></div>';
                el.onclick = function() { var b = document.getElementById('nav-chat'); if(b) b.click(); self.selectConvo('ch_'+ch.id); };
                c.appendChild(el);
            });
        },

        renderInbox: function() {
            var b = document.getElementById('inbox-badge'); if(!b) return;
            var unread = this.inbox.filter(function(n) { return !n.read; }).length;
            if(unread > 0) { b.style.display = 'flex'; b.textContent = unread; } else { b.style.display = 'none'; }
            
            var list = document.getElementById('inbox-list'); if(!list) return;
            list.innerHTML = '';
            if(!this.inbox.length) { list.innerHTML = '<div class="empty-state"><img src="logo.png" alt="" class="empty-state__logo"><h3>You\'re all caught up!</h3><p>No new notifications.</p></div>'; return; }
            
            var self = this;
            this.inbox.slice().reverse().forEach(function(n) {
                var el = document.createElement('div'); el.className = 'inbox-item' + (n.read ? '' : ' unread');
                el.innerHTML = '<div style="flex:1"><p style="font-size:0.85rem;line-height:1.4">'+n.text+'</p><span style="font-size:0.7rem;color:var(--text-tertiary)">'+n.time+'</span></div>';
                el.onclick = function() { n.read = true; self.save('inbox'); self.renderInbox(); };
                list.appendChild(el);
            });
        },

        notify: function(uid, text) {
            var ubox = S.get('inbox_'+uid, []);
            ubox.push({ id: Date.now(), text: text, time: dateNow() + ' ' + timeNow(), read: false });
            S.set('inbox_'+uid, ubox);
            if(uid === this.user.id) { this.inbox = ubox; this.renderInbox(); }
        },

        renderSidebar: function() {
            this.renderUserUI();
            this.renderConvoList();
        },

        renderConvoList: function() {
            var c = document.getElementById('channel-list-container'); if(!c) return;
            c.innerHTML = '';
            var self = this;

            c.appendChild(this.createBtn('Create Channel', function() { openModal('channel-modal-overlay'); }));

            var myChannels = this.channels.filter(function(ch){ return ch.members && ch.members.indexOf(self.user.id) > -1; });
            if(myChannels.length) {
                c.appendChild(this.createGroup('CHANNELS'));
                myChannels.forEach(function(ch) {
                    c.appendChild(self.createConvoItem('ch_'+ch.id, '# '+ch.id, (ch.members||[]).length));
                });
            }

            if(this.dms.length) {
                c.appendChild(this.createGroup('DIRECT MESSAGES'));
                this.dms.forEach(function(uid) {
                    var u = getUserById(uid); if(!u) return;
                    c.appendChild(self.createConvoItem('dm_'+[self.user.id,uid].sort().join('_'), fullName(u), null, u));
                });
            }

            c.appendChild(this.createBtn('New Message', function() { openModal('dm-modal-overlay'); }));
        },

        renderUserUI: function() {
            var u = this.user;
            var sa = document.getElementById('sidebar-avatar'); if(sa) sa.innerHTML = this.avatarHTML(u);
            var sn = document.getElementById('sidebar-user-name'); if(sn) sn.textContent = fullName(u);
            var sr = document.getElementById('sidebar-user-role'); if(sr) sr.textContent = u.role;
            var ma = document.getElementById('mobile-avatar'); if(ma) ma.innerHTML = this.avatarHTML(u, 'avatar--tiny');
            var mpa = document.getElementById('master-profile-avatar'); if(mpa) mpa.innerHTML = this.avatarHTML(u, 'avatar--small');
        },

        avatarHTML: function(u, cls) {
            cls = cls || '';
            if(!u) return '<div class="avatar '+cls+'"><span class="avatar-initials">?</span></div>';
            return u.avatar
                ? '<div class="avatar '+cls+'"><img src="'+u.avatar+'" alt=""></div>'
                : '<div class="avatar '+cls+'"><span class="avatar-initials">'+initials(u.firstName, u.lastName)+'</span></div>';
        },

        createBtn: function(txt, onClick) {
            var b = document.createElement('button'); b.className='btn btn--ghost btn--full'; b.style.cssText='margin:4px 8px;width:calc(100% - 16px);font-size:0.8rem;';
            b.innerHTML = txt; b.onclick = onClick; return b;
        },

        createGroup: function(label) {
            var g = document.createElement('div'); g.className='channel-group';
            g.innerHTML = '<span class="channel-group__label">'+label+'</span>'; return g;
        },

        createConvoItem: function(id, name, count, u) {
            var self = this;
            var b = document.createElement('button'); b.className = 'channel-item' + (this.activeConvo===id?' channel-item--active':'');
            b.dataset.convo = id;
            b.innerHTML = (u?this.avatarHTML(u,'avatar--small'):'<span class="channel-hash">'+name[0]+'</span>')+'<span class="channel-name">'+esc(u?fullName(u):name.slice(2))+'</span>'+(count?'<span class="member-count-badge">'+count+'</span>':'');
            b.onclick = function() { self.selectConvo(id); }; return b;
        },

        selectConvo: function(id) {
            this.activeConvo = id;
            var items = document.querySelectorAll('.channel-item');
            for(var i=0; i<items.length; i++) { items[i].classList.toggle('channel-item--active', items[i].dataset.convo===id); }
            
            var clp = document.getElementById('channel-list-panel');
            if(window.innerWidth<=768 && clp) clp.classList.add('hidden');

            var hName = document.getElementById('current-channel-name');
            var hHash = document.getElementById('chat-header-hash');
            var hCount = document.getElementById('header-member-count');
            var inp = document.getElementById('message-input');

            if(id.indexOf('ch_') === 0) {
                var chId = id.replace('ch_','');
                var ch = null; for(var j=0; j<this.channels.length; j++) { if(this.channels[j].id === chId) ch = this.channels[j]; }
                if(hHash) { hHash.textContent = '#'; hHash.style.display = ''; }
                if(hName) hName.textContent = ch ? ch.name : 'Channel';
                if(hCount) { hCount.textContent = (ch?ch.members.length:0) + ' members'; hCount.style.display = ''; }
                if(inp) inp.placeholder = 'Message #' + (ch?ch.name:'') + '...';
            } else {
                var parts = id.replace('dm_','').split('_');
                var otherId = parts[0] === this.user.id ? parts[1] : parts[0];
                var other = getUserById(otherId);
                if(hHash) hHash.style.display = 'none';
                if(hName) hName.textContent = fullName(other);
                if(hCount) hCount.style.display = 'none';
                if(inp) inp.placeholder = 'Message ' + (other?other.firstName:'') + '...';
            }
            this.renderMessages();
            var cip = document.getElementById('channel-info-panel'); if(cip) cip.style.display='none';
            var panels = document.querySelectorAll('.panel'); for(var k=0; k<panels.length; k++) panels[k].classList.remove('panel--active');
            var pChat = document.getElementById('panel-chat'); if(pChat) pChat.classList.add('panel--active');
        },

        bindGlobalSearch: function() {
            var self = this;
            var search = document.getElementById('global-search'); if(!search) return;
            search.addEventListener('input', function(e) {
                var q = e.target.value.toLowerCase();
                if(!q) { self.renderConvoList(); return; }
                var cList = document.getElementById('channel-list-container'); if(!cList) return;
                cList.innerHTML = self.createGroup('SEARCH RESULTS').outerHTML;
                var results = [];
                self.channels.forEach(function(ch) { if(ch.name.toLowerCase().indexOf(q) > -1) results.push({id:'ch_'+ch.id, name:ch.name}); });
                getAllUsers().forEach(function(u) { if(fullName(u).toLowerCase().indexOf(q) > -1 && u.id!==self.user.id) results.push({id:'dm_'+[self.user.id,u.id].sort().join('_'), name:fullName(u), u:u}); });
                if(!results.length) { cList.innerHTML += '<p style="padding:10px 16px;font-size:0.8rem;color:var(--text-tertiary)">No results</p>'; }
                results.forEach(function(r) { cList.appendChild(self.createConvoItem(r.id, r.name, null, r.u)); });
            });
        },

        toggleReaction: function(msgId, emoji) {
            var msgs = this.messages[this.activeConvo]; if(!msgs) return;
            var m = null; for(var i=0; i<msgs.length; i++) { if(msgs[i].id === msgId) m = msgs[i]; }
            if(!m) return;
            if(!m.reactions) m.reactions = {};
            if(!m.reactions[emoji]) m.reactions[emoji] = [];
            var idx = m.reactions[emoji].indexOf(this.user.id);
            if(idx>-1) m.reactions[emoji].splice(idx, 1);
            else m.reactions[emoji].push(this.user.id);
            if(!m.reactions[emoji].length) delete m.reactions[emoji];
            this.save('messages'); this.renderMessages();
        },

        renderMessages: function() {
            var c = document.getElementById('messages-container'); if(!c||!this.activeConvo) return;
            var msgs = this.messages[this.activeConvo] || [];
            var self = this;
            if(!msgs.length) {
                c.innerHTML = '<div class="empty-state"><img src="logo.png" alt="" class="empty-state__logo"><h3>No messages here yet</h3><p>Start the conversation with a friendly hello!</p></div>';
                return;
            }
            c.innerHTML = ''; var lastDate = '';
            msgs.forEach(function(m) {
                if(m.date!==lastDate){ lastDate=m.date; c.innerHTML+='<div class="message-date-divider"><span>'+esc(m.date)+'</span></div>'; }
                var el = document.createElement('div'); el.className = 'message';
                var filesHTML = '';
                if(m.files && m.files.length) {
                    filesHTML = '<div class="message__files">';
                    m.files.forEach(function(f) {
                        if(f.type.indexOf('image/') === 0) {
                            filesHTML += '<div class="message-file message-file--image" onclick="NexusApp.openLightbox(\''+f.data+'\', \''+f.name+'\')"><img src="'+f.data+'" alt=""></div>';
                        } else {
                            filesHTML += '<div class="message-file-generic" onclick="NexusApp.downloadFile(\''+f.data+'\', \''+f.name+'\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6v18h12V9z"/><polyline points="13 2 13 9 20 9"/></svg><div class="file-info"><span class="name">'+esc(f.name)+'</span><span class="size">'+fmtSize(f.size)+'</span></div></div>';
                        }
                    });
                    filesHTML += '</div>';
                }
                var reactionsHTML = '';
                if(m.reactions && Object.keys(m.reactions).length) {
                    reactionsHTML = '<div class="message-reactions">';
                    for(var emoji in m.reactions) {
                        var uids = m.reactions[emoji];
                        var active = uids.indexOf(self.user.id) > -1;
                        reactionsHTML += '<button class="reaction-tag '+(active?'reaction-tag--active':'')+'" onclick="NexusApp.toggleReaction(\''+m.id+'\', \''+emoji+'\')">'+emoji+' <span>'+uids.length+'</span></button>';
                    }
                    reactionsHTML += '</div>';
                }
                el.innerHTML = self.avatarHTML(m.user, 'avatar--small') +
                    '<div class="message__content"><div class="message__header">' +
                    '<div class="message__author" onclick="NexusApp.viewProfile(\''+m.user.id+'\')">'+esc(fullName(m.user))+'</div>' +
                    '<span class="message__time">'+m.time+'</span><div class="message-actions">' +
                    '<button class="msg-action-btn" onclick="NexusApp.showReactionPicker(event, \''+m.id+'\')" title="Add reaction"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></button></div></div>' +
                    (m.text?'<p class="message__text">'+esc(m.text)+'</p>':'') + filesHTML + reactionsHTML + '</div>';
                c.appendChild(el);
            });
            c.scrollTop = c.scrollHeight;
        },

        showReactionPicker: function(e, msgId) {
            e.stopPropagation();
            var picker = document.getElementById('emoji-picker'); if(!picker) return;
            picker.style.display = 'block'; picker.style.position = 'fixed';
            picker.style.top = (e.clientY - 300) + 'px'; picker.style.left = (e.clientX - 150) + 'px';
            var self = this;
            this.renderEmoji('smileys', function(emoji) {
                self.toggleReaction(msgId, emoji); picker.style.display = 'none';
            });
        },

        sendMessage: function() {
            var inp = document.getElementById('message-input');
            var txt = inp.value.trim(); if(!txt && !this.pendingFiles.length) return;
            if(!this.activeConvo) { toast('Select a conversation', 'error'); return; }
            if(!this.messages[this.activeConvo]) this.messages[this.activeConvo] = [];
            this.messages[this.activeConvo].push({
                id: Date.now().toString(), text: txt, time: timeNow(), date: dateNow(),
                user: {id:this.user.id, firstName:this.user.firstName, lastName:this.user.lastName, avatar:this.user.avatar},
                files: this.pendingFiles.map(function(f){ return {name:f.name, size:f.size, type:f.type, data:f.data}; })
            });
            this.save('messages'); inp.value = ''; this.pendingFiles = []; this.renderFilePreview(); this.renderMessages();
        },

        viewProfile: function(uid) {
            var u = getUserById(uid) || this.user; if(!u) return;
            var banner = document.getElementById('profile-banner'); if(banner) banner.style.background = 'linear-gradient(135deg, #00d4ff, #1a1a2e)';
            var pal = document.getElementById('profile-avatar-large'); if(pal) pal.innerHTML = u.avatar ? '<img src="'+u.avatar+'" alt="">' : '<span style="font-size:2.5rem;font-weight:800;color:var(--text-primary)">'+initials(u.firstName, u.lastName)+'</span>';
            var pn = document.getElementById('profile-name'); if(pn) pn.textContent = fullName(u);
            var pr = document.getElementById('profile-role'); if(pr) pr.textContent = u.role;
            var pe = document.getElementById('profile-email'); if(pe) pe.textContent = u.email;
            var dmBtn = document.getElementById('profile-dm-btn');
            var self = this;
            if(dmBtn) {
                if(u.id===this.user.id) {
                    dmBtn.textContent = 'Edit Profile'; dmBtn.onclick = function() { closeModal('profile-view-overlay'); openModal('edit-profile-overlay'); };
                } else {
                    dmBtn.textContent = 'Send Message'; dmBtn.onclick = function() { closeModal('profile-view-overlay'); self.startDM(u.id); };
                }
            }
            openModal('profile-view-overlay');
        },

        startDM: function(uid) {
            if(this.dms.indexOf(uid) === -1) { this.dms.push(uid); this.save('dms'); this.renderSidebar(); }
            this.selectConvo('dm_'+[this.user.id, uid].sort().join('_'));
            var panels = document.querySelectorAll('.panel'); for(var i=0; i<panels.length; i++) panels[i].classList.remove('panel--active');
            var pc = document.getElementById('panel-chat'); if(pc) pc.classList.add('panel--active');
            var navs = document.querySelectorAll('.nav-btn'); for(var j=0; j<navs.length; j++) navs[j].classList.remove('nav-btn--active');
            var nc = document.getElementById('nav-chat'); if(nc) nc.classList.add('nav-btn--active');
        },

        openLightbox: function(data, name) {
            var media = document.getElementById('lightbox-media'); if(!media) return;
            media.innerHTML = '<img src="'+data+'" alt="">';
            var fn = document.getElementById('lightbox-filename'); if(fn) fn.textContent = name;
            var ld = document.getElementById('lightbox-download'); if(ld) { ld.href = data; ld.download = name; }
            openModal('lightbox-overlay');
        },

        downloadFile: function(data, name) { var a = document.createElement('a'); a.href=data; a.download=name; a.click(); },

        renderTasks: function() {
            var self = this;
            var columns = ['todo', 'inprogress', 'done'];
            columns.forEach(function(col) {
                var container = document.querySelector('[data-column="'+col+'"] .kanban-column__cards'); if(!container) return;
                container.innerHTML = '';
                var colTasks = self.tasks.filter(function(t){ return t.column === col; });
                if(!colTasks.length) container.innerHTML = '<div class="kanban-empty-state"><p>No tasks yet</p></div>';
                colTasks.forEach(function(t) {
                    var card = document.createElement('div'); card.className = 'task-card glass-panel-inner';
                    card.draggable = true; card.dataset.taskId = t.id;
                    var asHTML = t.assigneeId ? self.avatarHTML(getUserById(t.assigneeId), 'avatar--tiny') : '';
                    card.innerHTML = '<div class="task-card__tags"><span class="tag tag--'+t.priority+'">'+t.priority+'</span><span class="tag tag--'+t.tag+'">'+t.tag+'</span></div>' +
                        '<h4 class="task-card__title">'+esc(t.title)+'</h4>' +
                        '<div class="task-card__footer"><div class="task-card__assignees">'+self.avatarHTML(getUserById(t.reporterId), 'avatar--tiny')+asHTML+'</div>' +
                        '<div class="task-card__meta">'+(t.comments?t.comments.length:0)+' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div></div>';
                    card.onclick = function() { self.openTaskDetail(t.id); };
                    card.addEventListener('dragstart', function() { card.classList.add('dragging'); });
                    card.addEventListener('dragend', function() { card.classList.remove('dragging'); });
                    container.appendChild(card);
                });
            });
            this.updateCounts();
        },

        openTaskDetail: function(tid) {
            var t = null; for(var i=0; i<this.tasks.length; i++) { if(this.tasks[i].id === tid) t = this.tasks[i]; }
            if(!t) return;
            this.currentTask = t;
            var tidb = document.getElementById('detail-task-id'); if(tidb) tidb.textContent = 'TASK-'+t.id.slice(-4);
            var dtt = document.getElementById('detail-task-title'); if(dtt) dtt.textContent = t.title;
            var dtd = document.getElementById('detail-task-desc'); if(dtd) dtd.value = t.desc || '';
            var dts = document.getElementById('detail-task-status'); if(dts) dts.value = t.column;
            var dtp = document.getElementById('detail-task-priority'); if(dtp) dtp.value = t.priority;
            var dtc = document.getElementById('detail-task-category'); if(dtc) dtc.value = t.tag;
            var dtr = document.getElementById('detail-task-reporter'); if(dtr) { var rep = getUserById(t.reporterId); dtr.innerHTML = this.avatarHTML(rep, 'avatar--small')+'<span>'+fullName(rep)+'</span>'; }
            this.setAssigneeTag('detail', t.assigneeId);
            this.renderComments(); openModal('task-detail-overlay');
        },

        // ===== ASSIGNEE AUTOCOMPLETE SYSTEM =====
        initAssigneeSearch: function(prefix) {
            var self = this;
            var searchInput = document.getElementById(prefix + '-assignee-search');
            var resultsDiv = document.getElementById(prefix + '-assignee-results');
            if(!searchInput || !resultsDiv) return;

            searchInput.oninput = function() {
                var q = searchInput.value.trim().toLowerCase();
                resultsDiv.innerHTML = '';
                if(!q) { resultsDiv.classList.remove('show'); return; }

                var users = getAllUsers().filter(function(u) {
                    var name = fullName(u).toLowerCase();
                    var email = (u.email || '').toLowerCase();
                    return name.indexOf(q) > -1 || email.indexOf(q) > -1;
                });

                if(!users.length) {
                    resultsDiv.innerHTML = '<div style="padding:12px;font-size:0.8rem;color:var(--text-tertiary)">No users found</div>';
                    resultsDiv.classList.add('show');
                    return;
                }

                users.forEach(function(u) {
                    var item = document.createElement('div');
                    item.className = 'assignee-result-item';
                    item.innerHTML = self.avatarHTML(u, 'avatar--tiny') + '<span class="result-name">' + esc(fullName(u)) + '</span><span class="result-role">' + esc(u.role || '') + '</span>';
                    item.onclick = function() {
                        self.setAssigneeTag(prefix, u.id);
                        searchInput.value = '';
                        resultsDiv.classList.remove('show');
                    };
                    resultsDiv.appendChild(item);
                });
                resultsDiv.classList.add('show');
            };

            searchInput.onfocus = function() { if(searchInput.value.trim()) searchInput.oninput(); };
            document.addEventListener('click', function(e) {
                if(!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
                    resultsDiv.classList.remove('show');
                }
            });
        },

        setAssigneeTag: function(prefix, userId) {
            var hiddenInput = document.getElementById(prefix === 'task' ? 'task-assignee-id' : 'detail-task-assignee');
            var tagDiv = document.getElementById(prefix + '-assigned-tag');
            var searchInput = document.getElementById(prefix + '-assignee-search');
            if(!hiddenInput || !tagDiv) return;

            if(!userId) {
                hiddenInput.value = '';
                tagDiv.style.display = 'none';
                tagDiv.innerHTML = '';
                if(searchInput) { searchInput.style.display = ''; searchInput.value = ''; }
                return;
            }

            var u = getUserById(userId);
            if(!u) return;
            hiddenInput.value = u.id;
            tagDiv.style.display = 'flex';
            tagDiv.innerHTML = this.avatarHTML(u, 'avatar--tiny') + '<span>' + esc(fullName(u)) + '</span><button class="remove-assignee" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
            if(searchInput) searchInput.style.display = 'none';

            var self = this;
            var removeBtn = tagDiv.querySelector('.remove-assignee');
            if(removeBtn) removeBtn.onclick = function() { self.setAssigneeTag(prefix, null); };
        },

        renderComments: function() {
            var list = document.getElementById('task-comments-list'); if(!list) return;
            list.innerHTML = '';
            var self = this;
            (this.currentTask.comments || []).forEach(function(c) {
                var u = getUserById(c.uid);
                var el = document.createElement('div'); el.className = 'task-comment';
                el.innerHTML = self.avatarHTML(u, 'avatar--small')+'<div class="comment-content"><div class="comment-author">'+esc(fullName(u))+'<span class="comment-time">'+c.time+'</span></div><p class="comment-text">'+esc(c.text)+'</p></div>';
                list.appendChild(el);
            });
        },

        addComment: function() {
            var inp = document.getElementById('task-comment-input');
            var txt = inp.value.trim(); if(!txt) return;
            if(!this.currentTask.comments) this.currentTask.comments = [];
            this.currentTask.comments.push({ uid:this.user.id, text:txt, time:timeNow() });
            this.save('tasks'); inp.value = ''; this.renderComments(); this.renderTasks();
        },

        saveTaskChanges: function() {
            var t = this.currentTask; if(!t) return;
            var oldCol = t.column;
            var oldAssignee = t.assigneeId;
            t.title = document.getElementById('detail-task-title').textContent;
            t.desc = document.getElementById('detail-task-desc').value;
            t.column = document.getElementById('detail-task-status').value;
            t.priority = document.getElementById('detail-task-priority').value;
            t.tag = document.getElementById('detail-task-category').value;
            t.assigneeId = document.getElementById('detail-task-assignee').value;
            
            if (oldCol !== t.column && t.reporterId !== this.user.id) {
                this.notify(t.reporterId, this.user.firstName + ' moved your task "' + t.title + '" to ' + t.column);
            }
            if (oldAssignee !== t.assigneeId && t.assigneeId && t.assigneeId !== this.user.id) {
                this.notify(t.assigneeId, this.user.firstName + ' assigned you to task "' + t.title + '"');
            }

            this.save('tasks'); this.renderTasks(); this.renderDashTasks(); closeModal('task-detail-overlay'); toast('Task saved');
        },

        toggleCallFeature: function(type) {
            if(type === 'screen' && this.secs > 0) {
               navigator.mediaDevices.getDisplayMedia({video:true}).then(function(ss) {
                   var grid = document.getElementById('video-grid');
                   var tile = document.createElement('div'); tile.className='video-tile video-tile--screen';
                   var vid = document.createElement('video'); vid.srcObject = ss; vid.autoplay = true;
                   tile.appendChild(vid); tile.innerHTML+='<div class="video-tile__overlay">Screen Share</div>';
                   if(grid) grid.appendChild(tile); ss.getVideoTracks()[0].onended = function() { tile.remove(); };
               }).catch(function(e) { toast('Share cancelled', 'error'); });
            }
        },

        bindEvents: function() {
            var self = this;
            var modals = ['channel-modal', 'dm-modal', 'task-modal', 'invite-modal', 'edit-profile', 'profile-view', 'task-detail', 'lightbox', 'settings'];
            modals.forEach(function(m) {
                var ov = document.getElementById(m+'-overlay');
                if(ov) {
                   var btns = ov.querySelectorAll('[id$="-close"], [id$="-cancel"]');
                   for(var i=0; i<btns.length; i++) { btns[i].onclick = function() { closeModal(m+'-overlay'); }; }
                   ov.onclick = function(e) { if(e.target===ov) closeModal(m+'-overlay'); };
                }
            });
            var click = function(id, fn) { var el = document.getElementById(id); if(el) el.onclick = fn; };
            click('send-btn', function() { self.sendMessage(); });
            var mi = document.getElementById('message-input'); if(mi) mi.onkeydown = function(e) { if(e.key==='Enter'&&!e.shiftKey) self.sendMessage(); };
            click('attach-btn', function() { var fi = document.getElementById('file-input'); if(fi) fi.click(); });
            var fi = document.getElementById('file-input'); if(fi) fi.onchange = function(e) { self.handleFiles(e.target.files); };
            click('emoji-btn', function(e) { e.stopPropagation(); self.toggleEmoji(); });
            
            var navBtns = document.querySelectorAll('.nav-btn');
            navBtns.forEach(function(b) {
                if(b.id==='logout-btn' || b.id==='nav-settings' || b.id==='nav-strip-toggle') return;
                b.onclick = function() {
                   for(var k=0; k<navBtns.length; k++) navBtns[k].classList.remove('nav-btn--active');
                   b.classList.add('nav-btn--active');
                   var tid = b.id.replace('nav-','');
                   if(tid === 'activity') tid = 'dashboard';
                   var panels = document.querySelectorAll('.panel'); for(var p=0; p<panels.length; p++) panels[p].classList.remove('panel--active');
                   var pan = document.getElementById('panel-'+tid); if(pan) pan.classList.add('panel--active');
                   if(tid === 'dashboard') self.renderDashboard();
                   if(window.innerWidth<=768) self.closeMobile();
                };
            });
            click('logout-btn', function() { S.del('currentUser'); location.reload(); });
            click('new-task-btn', function() { openModal('task-modal-overlay'); });
            click('add-people-btn', function() { openModal('invite-modal-overlay'); });
            click('nav-settings', function() { 
                var sn = document.getElementById('settings-name'); if(sn) sn.value = fullName(self.user);
                var se = document.getElementById('settings-email'); if(se) se.value = self.user.email;
                openModal('settings-overlay'); 
            });
            click('settings-save-account', function() {
                var sn = document.getElementById('settings-name'); if(sn) {
                    var parts = sn.value.trim().split(' ');
                    self.user.firstName = parts[0] || '';
                    self.user.lastName = parts.slice(1).join(' ') || '';
                    S.set('currentUser', self.user);
                    self.renderUserUI();
                    toast('Account updated');
                    closeModal('settings-overlay');
                }
            });

            // Settings Tabs
            var sTabs = document.querySelectorAll('.settings-tab');
            sTabs.forEach(function(tb) {
                tb.onclick = function() {
                    sTabs.forEach(function(t) { t.classList.remove('active'); });
                    tb.classList.add('active');
                    document.querySelectorAll('.settings-pane').forEach(function(p) { p.style.display = 'none'; });
                    var pId = 'pane-' + tb.dataset.tab;
                    var pane = document.getElementById(pId); if(pane) pane.style.display = 'block';
                };
            });

            // Dashboard & Sidebar
            click('dash-action-chat', function() { var nb = document.getElementById('nav-chat'); if(nb) nb.click(); });
            click('dash-action-task', function() { var nb = document.getElementById('nav-tasks'); if(nb) nb.click(); });
            click('dash-action-call', function() { self.startCall('video'); });
            click('dash-new-task-btn', function() { self.setAssigneeTag('task', null); openModal('task-modal-overlay'); });
            click('dash-quick-msg', function() { var nb = document.getElementById('nav-chat'); if(nb) nb.click(); });
            click('dash-quick-task', function() { self.setAssigneeTag('task', null); openModal('task-modal-overlay'); });
            click('sidebar-toggle-btn', function() {
                var sb = document.getElementById('sidebar'); if(sb) sb.classList.toggle('collapsed');
            });
            click('nav-strip-toggle', function() {
                var strip = document.getElementById('nav-strip'); if(strip) strip.classList.toggle('expanded');
            });
            click('dash-comms-toggle', function() {
                var b = document.getElementById('dash-my-comms'); if(b) b.style.display = b.style.display === 'none' ? 'flex' : 'none';
                var i = document.getElementById('dash-comms-icon'); if(i) i.classList.toggle('collapsed');
            });

            // Inbox Actions
            click('clear-inbox-btn', function() { self.inbox = []; self.save('inbox'); self.renderInbox(); toast('Inbox cleared'); });
            click('send-invite-btn', function() {
                var em = document.getElementById('invite-email-input'); if(!em || !em.value) return;
                var u = getAllUsers().find(function(x){return x.email === em.value;});
                if(u) { self.notify(u.id, self.user.firstName + ' invited you to join Nexus Workspace!'); toast('Invite sent!'); em.value=''; closeModal('invite-modal-overlay'); }
                else { toast('User not found. Try a direct link.', 'error'); }
            });

            // Assignee Autocomplete
            self.initAssigneeSearch('task');
            self.initAssigneeSearch('detail');

            click('mobile-profile-btn', function() { self.viewProfile(self.user.id); });
            click('master-profile-avatar', function() { self.viewProfile(self.user.id); });
            click('sidebar-user-profile', function() { self.viewProfile(self.user.id); });
            click('current-channel-name', function() { self.toggleChannelInfo(); });
            click('close-info-panel', function() { self.toggleChannelInfo(); });
            
            // Mobile Menu
            click('mobile-menu-btn', function() { self.openMobile(); });
            click('sidebar-overlay', function() { self.closeMobile(); });

            // Calls
            click('start-channel-audio-btn', function() { self.startCall('audio'); });
            click('start-channel-call-btn', function() { self.startCall('video'); });
            click('channel-info-btn', function() { self.toggleChannelInfo(); });
            click('btn-endcall', function() { self.endCall(); });

            click('add-comment-btn', function() { self.addComment(); });
            click('task-modal-create', function() { self.createTask(); });
            click('task-detail-save', function() { self.saveTaskChanges(); });
            click('task-detail-delete', function() { self.tasks = self.tasks.filter(function(x){ return x.id !== self.currentTask.id; }); self.save('tasks'); self.renderTasks(); closeModal('task-detail-overlay'); });
            click('btn-screenshare', function() { self.toggleCallFeature('screen'); });
        },

        openMobile: function() {
            var s = document.getElementById('sidebar'); if(s) s.classList.add('open');
            var ov = document.getElementById('sidebar-overlay'); if(ov) ov.classList.add('active');
        },

        closeMobile: function() {
            var s = document.getElementById('sidebar'); if(s) s.classList.remove('open');
            var ov = document.getElementById('sidebar-overlay'); if(ov) ov.classList.remove('active');
        },

        createTask: function() {
            var title = document.getElementById('task-title-input').value.trim();
            var desc = document.getElementById('task-desc-input').value.trim();
            var prio = document.getElementById('task-priority-select').value;
            var tag = document.getElementById('task-tag-select').value;
            var assignee = document.getElementById('task-assignee-id').value;
            
            if(!title) { toast('Task title is required', 'error'); return; }

            var newTask = {
                id: 'T-' + Date.now().toString().slice(-6),
                title: title,
                desc: desc,
                priority: prio,
                tag: tag,
                column: 'todo',
                reporterId: this.user.id,
                assigneeId: assignee,
                comments: []
            };

            this.tasks.push(newTask);
            this.save('tasks');
            this.renderTasks();
            this.renderDashTasks();
            this.renderDashboard();
            if (assignee && assignee !== this.user.id) {
                this.notify(assignee, this.user.firstName + ' assigned a new task to you: "' + title + '"');
            }
            
            // Reset & Close
            document.getElementById('task-title-input').value = '';
            document.getElementById('task-desc-input').value = '';
            this.setAssigneeTag('task', null);
            closeModal('task-modal-overlay');
            toast('Task created successfully');
        },

        toggleChannelInfo: function() {
            var cip = document.getElementById('channel-info-panel'); if(!cip) return;
            var isVis = cip.style.display !== 'none';
            cip.style.display = isVis ? 'none' : 'flex';
            if(!isVis) this.renderChannelDetails();
        },

        renderChannelDetails: function() {
            var hName = document.getElementById('current-channel-name');
            var desc = document.getElementById('info-panel-desc');
            var count = document.getElementById('info-member-count');
            var list = document.getElementById('info-members-list');
            if(!desc || !list) return;

            var id = this.activeConvo;
            if(id && id.indexOf('ch_') === 0) {
                var chId = id.replace('ch_','');
                var ch = null; for(var i=0; i<this.channels.length; i++) { if(this.channels[i].id===chId) ch = this.channels[i]; }
                desc.textContent = ch ? (ch.description || 'No description') : 'No description';
                var mIds = ch ? ch.members : [];
                count.textContent = mIds.length;
                list.innerHTML = '';
                var self = this;
                mIds.forEach(function(uid) {
                    var u = getUserById(uid); if(!u) return;
                    var item = document.createElement('div'); item.className = 'info-member-item';
                    item.innerHTML = self.avatarHTML(u, 'avatar--small') + '<span>' + fullName(u) + '</span>';
                    item.onclick = function() { self.viewProfile(u.id); };
                    list.appendChild(item);
                });
            } else {
                desc.textContent = 'Direct messages are private conversations.';
                count.textContent = '2';
                list.innerHTML = 'Members in this conversation are private.';
            }
        },

        startCall: function(type) {
            var self = this;
            document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('panel--active'); });
            document.getElementById('panel-calls').classList.add('panel--active');
            document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.remove('nav-btn--active'); });
            document.getElementById('nav-calls').classList.add('nav-btn--active');

            var empty = document.getElementById('call-empty-state'); if(empty) empty.style.display='none';
            var controls = document.getElementById('call-controls'); if(controls) controls.style.display='flex';
            var grid = document.getElementById('video-grid'); if(grid) grid.innerHTML = '';

            // Add local tile
            var tile = document.createElement('div'); tile.className = 'video-tile';
            tile.innerHTML = this.avatarHTML(this.user, 'avatar--xl') + '<div class="video-tile__overlay">You ('+type+')</div>';
            if(grid) grid.appendChild(tile);

            toast('Starting ' + type + ' call...');
            if(this.timer) clearInterval(this.timer);
            this.secs = 0;
            this.timer = setInterval(function() {
                self.secs++;
                var m = Math.floor(self.secs / 60), s = self.secs % 60;
                var ds = document.getElementById('call-duration');
                if(ds) ds.textContent = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
            }, 1000);
        },

        endCall: function() {
            if(this.timer) clearInterval(this.timer);
            var ds = document.getElementById('call-duration'); if(ds) ds.textContent = '';
            var empty = document.getElementById('call-empty-state'); if(empty) empty.style.display='flex';
            var controls = document.getElementById('call-controls'); if(controls) controls.style.display='none';
            var grid = document.getElementById('video-grid'); if(grid) grid.innerHTML = '';
            toast('Call ended');
        },

        handleFiles: function(files) {
            var self = this;
            Array.from(files).forEach(function(f) {
                var reader = new FileReader(); reader.onload = function(e) {
                    self.pendingFiles.push({ name:f.name, size:f.size, type:f.type, data:e.target.result });
                    self.renderFilePreview();
                }; reader.readAsDataURL(f);
            });
        },

        renderFilePreview: function() {
            var bar = document.getElementById('file-preview-bar'), items = document.getElementById('file-preview-items');
            if(!this.pendingFiles.length) { if(bar) bar.style.display='none'; return; }
            if(bar) bar.style.display='flex'; if(items) items.innerHTML='';
            var self = this;
            this.pendingFiles.forEach(function(f,i) {
                var d = document.createElement('div'); d.className='file-preview-item';
                d.innerHTML = (f.type.indexOf('image/') === 0?'<img src="'+f.data+'">':'')+'<span>'+esc(f.name)+'</span>';
                var rm = document.createElement('button'); rm.className='icon-btn'; rm.innerHTML='✕';
                rm.onclick = function() { self.pendingFiles.splice(i,1); self.renderFilePreview(); };
                d.appendChild(rm); if(items) items.appendChild(d);
            });
        },

        updateCounts: function() { 
            var cols = document.querySelectorAll('.kanban-column');
            cols.forEach(function(c) { var n = c.querySelectorAll('.task-card').length; var cc = c.querySelector('.column-count'); if(cc) cc.textContent = n; }); 
        },

        toggleEmoji: function() {
            var p = document.getElementById('emoji-picker'); if(!p) return;
            var vis = p.style.display==='block'; p.style.display = vis?'none':'block';
            if(!vis) this.renderEmoji('smileys');
        },

        renderEmoji: function(cat, cb) {
            var grid = document.getElementById('emoji-grid'); if(!grid) return;
            grid.innerHTML = '';
            var emojis = EMOJI_CATEGORIES[cat] || [];
            emojis.forEach(function(em) {
               var b = document.createElement('button'); b.textContent = em;
               b.onclick = function() { if(cb) cb(em); else { var mi = document.getElementById('message-input'); if(mi) mi.value += em; } };
               grid.appendChild(b);
            });
            var tabs = document.querySelectorAll('.emoji-tab');
            for(var i=0; i<tabs.length; i++) { tabs[i].classList.toggle('emoji-tab--active', tabs[i].dataset.category===cat); }
        },

        bindMobile: function() {
            var self = this;
            var click = function(id, fn) { var el = document.getElementById(id); if(el) el.onclick = fn; };
            click('mobile-menu-btn', function() { 
                var sb = document.getElementById('sidebar'); if(sb) sb.classList.add('open'); 
                var sbo = document.getElementById('sidebar-overlay'); if(sbo) sbo.classList.add('active'); 
            });
            click('sidebar-overlay', function() { self.closeMobile(); });
            click('channel-back-btn', function() { var clp = document.getElementById('channel-list-panel'); if(clp) clp.classList.remove('hidden'); });
        },

        closeMobile: function() { 
            var sb = document.getElementById('sidebar'); if(sb) sb.classList.remove('open'); 
            var sbo = document.getElementById('sidebar-overlay'); if(sbo) sbo.classList.remove('active'); 
        },

        renderMembers: function() {
            var grid = document.getElementById('members-grid'); if(!grid) return;
            grid.innerHTML = ''; var self = this;
            getAllUsers().forEach(function(u) {
                var card = document.createElement('div'); card.className = 'member-card';
                card.innerHTML = self.avatarHTML(u)+'<div class="member-card__info"><span class="member-card__name">'+fullName(u)+'</span><span class="member-card__role">'+u.role+'</span></div>';
                card.onclick = function() { self.viewProfile(u.id); }; grid.appendChild(card);
            });
        }
    };

    // ========== AUTH MOCK ==========
    const Auth = {
        init: function() {
            window.NexusApp = NexusApp;
            var as = document.getElementById('auth-screen'); if(as) as.style.display='flex';
            var a = document.getElementById('app'); if(a) a.style.display='none';
            var bind = function(id, ev, fn) { var el = document.getElementById(id); if(el) el[ev] = fn; };
            bind('login-form', 'onsubmit', function(e) {
                e.preventDefault();
                var em = document.getElementById('login-email').value;
                var users = getAllUsers(); 
                var u = null; for(var i=0; i<users.length; i++) { if(users[i].email===em) u = users[i]; }
                if(u) { S.set('currentUser', u); NexusApp.init(); } else toast('User not found', 'error');
            });
            bind('signup-form', 'onsubmit', function(e) {
                e.preventDefault();
                var fn = document.getElementById('signup-firstname').value, ln = document.getElementById('signup-lastname').value, em = document.getElementById('signup-email').value, role = document.getElementById('signup-role').value;
                var nu = {id:Date.now().toString(), firstName:fn, lastName:ln, email:em, role:role, avatar:''};
                var users = getAllUsers(); users.push(nu); S.set('users', users); S.set('currentUser', nu);
                NexusApp.init();
            });
            var click = function(id, fn) { var el = document.getElementById(id); if(el) el.onclick = fn; };
            click('goto-signup', function() { document.getElementById('login-view').style.display='none'; document.getElementById('signup-view').style.display='block'; });
            click('goto-login', function() { document.getElementById('signup-view').style.display='none'; document.getElementById('login-view').style.display='block'; });
        }
    };

    window.NexusApp = NexusApp;
    NexusApp.init();
})();
