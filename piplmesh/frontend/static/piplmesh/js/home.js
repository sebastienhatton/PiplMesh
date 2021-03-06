var POSTS_LIMIT = 20;

function howManyColumns() {
    var panelsWidth = $('#panels').innerWidth();
    var columnPanelsWidth = $('.panels_column').outerWidth(true);

    return parseInt(panelsWidth / columnPanelsWidth);
}

function movePanel(name, columnIndex) {
    $('#panel-' + name).appendTo($('#panels').children().eq(columnIndex));
}

function initializeEmptyColumnsForPanels() {
    var panels = $('.panel').detach();
    var currentColumns = $('#panels').children().length;
    var numberOfColumns = howManyColumns();

    for (var i = currentColumns; i < numberOfColumns; i++) {
        var newColumn = $('<div/>');
        newColumn.addClass('panels_column');
        $('#panels').append(newColumn);
    }

    var removeColumsFromIndex = numberOfColumns - 1;
    $('#panels').find('.panels_column:gt(' + removeColumsFromIndex + ')').remove();
    panels.appendTo('.panels_column:first');
}

function orderPanelsDefault() {
    var numberOfColumns = howManyColumns();

    $('.panel').each(function (index, panel) {
        var toColumn = index % numberOfColumns;
        var columns = $('#panels').children();

        $(panel).appendTo(columns.eq(toColumn));
    });
}

function sendOrderOfPanelsToServer() {
    var names = [];
    var columns = [];
    var numberOfColumns = 0;

    $('#panels').children().each(function (i, column) {
        numberOfColumns++;
        $(column).children().each(function (j, panel) {
            names.push($(panel).prop('id').substr('panel-'.length));
            columns.push(i);
        });
    });

    if (numberOfColumns) {
        $.post(URLS.panels_order, {
            'names': names,
            'columns': columns,
            'number_of_columns': numberOfColumns
        });
    }
}

function orderPanels() {
    $.getJSON(URLS.panels_order, {
        'number_of_columns': howManyColumns()
    }, function (data, textStatus, jqXHR) {
        if (data.length == 0) {
            orderPanelsDefault();
        }
        else {
            $.each(data, function (i, column) {
                $.each(column, function (j, panel) {
                    movePanel(panel, i);
                });
            });
        }
    });
}

function collapsePanels() {
    $.getJSON(URLS.panels_collapse, function (data, textStatus, jqXHR) {
        $.each(data, function (name, collapsed) {
            if (collapsed) {
                $('#panel-' + name + ' .content').css('display', 'none');
            }
        });
    });
}

function initializePanels() {
    initializeEmptyColumnsForPanels();
    orderPanels();
    collapsePanels();
    makeColumnsSortable();
    makePanelsOrderUpdatable();
}

function makeColumnsSortable() {
    $('.panels_column').sortable({
        'connectWith': '.panels_column',
        'handle': '',
        'cursor': 'move',
        'placeholder': 'placeholder',
        'forcePlaceholderSize': true,
        'opacity': 0.6,
        'helper': 'clone'
    }).disableSelection();
}

function makePanelsOrderUpdatable() {
    $('.panels_column').bind('sortstop', function (event, ui) {
        sendOrderOfPanelsToServer();
    });
}

function Post(data) {
    var self = this;
    $.extend(self, data);

    function createDOM() {
        // TODO: Improve and add other post options
        var delete_link = $('<li/>').append(
            $('<a/>').addClass('delete-post hand').text(gettext("Delete"))
        );
        var edit_link = $('<li/>').append(
            $('<a/>').addClass('edit-post hand').text(gettext("Edit"))
        );
        var post_options = $('<ul />').addClass('options').append(edit_link, delete_link);
        
        // TODO: Author link shouldn't be hardcoded
        var author_link = $('<a/>').attr('href', '/user/' + self.author.username).addClass('author hand').text(self.author.username);

        var date = $('<span/>').addClass('date');
        new Date(self.created_time).updatingNaturaltime(date);

        var post = $('<li/>').addClass('post').data('post', self).append(post_options).append(
            $('<span/>').append(author_link)
        ).append(
            $('<p/>').addClass('content').text(self.message)
        ).append(
            date
        ).append(
           $('<span/>').append($('<ul/>').addClass('comments'))
        ).append(
           $('<span/>').append(createCommentForm())
        );
        
        return post;
    }
    
    function createCommentForm() {
        // TODO: Instead of creating forms use a static form from template, clone it and append event handlers
        var textarea = $('<textarea/>').addClass('comment_text');
        var input = $('<input/>').attr({
            'type': 'button',
            'value': 'submit',
            'name': 'submit_comment'
        }).click(function (event) {
            // TODO: Disable enable submit button like with the Post. After submitting clear the textarea of text
            // TODO: Push new comments to all clients and display them automatically and do not use textarea content but use data from the server (it might be processed)
            addComment(textarea.val(), buildCommentURL(self.id));
        });
        var form = $('<form/>').append(textarea, input);
        
        return form;
    }
    
    function getComment(comment_url) {
        $.getJSON(comment_url, function (data, textStatus, jqXHR) {
            new Comment(data, self).appendToPost();
        });
    }
    
    function displayComments() {
        // TODO: We call comments in the right order but that doesn't mean we get them in the right order aswell. Should make some ordering down the road
        $.each(self.comments, function (index, comment_url) {
            getComment(comment_url);
        });
    }
    
    function checkIfPostExists() {
        return $('.post').is(function (index) {
            return $(this).data('post').id == self.id;
        });
    }

    function postByUser() {
        var user_posts_URIs = $('.posts').data('user_posts_URIs');
        var full_resource_uri = getLocation(self.resource_uri).href;
        return $.inArray(full_resource_uri, user_posts_URIs) != -1;
    }

    function showPost(post) {
        // TODO: Animation has to be considered and maybe improved
        post.show('fast');
    };

    self.addToBottom = function () {
        if (checkIfPostExists()) return;
        
        $('.posts').append(createDOM());
        displayComments();
    };

    self.addToTop = function () {
        if (checkIfPostExists()) return;

        var post = createDOM().hide().prependTo($('.posts'));
        displayComments();
        
        if (postByUser()) {
            // TODO: Maybe we should remove URI after showing user's post
            showPost(post);
            return;
        }

        if (!autoShowIncomingPosts()) {
            post.addClass('notShown');
        }
        else {
            showPost(post);
        }
        updateHiddenPostsCount();
        $('#toggle_queue').show();
        if (!autoShowIncomingPosts()) {
            $('#posts_in_queue, #show_posts').show();
        }
    };
}

function Comment(data, post) {
    var self = this;
    $.extend(self, data);
    self.post = post;
    
    function createDOM() {
        // TODO: Author link shouldn't be hardcoded
        var author_link = $('<a/>').attr('href', '/user/' + self.author.username).addClass('author hand').text(self.author.username);
        var date = $('<span/>').addClass('date');
        new Date(self.created_time).updatingNaturaltime(date);
        var comment = $('<li/>').addClass('comment').data('comment', self).append(
            $('<span/>').append(author_link)
        ).append(
            $('<p/>').addClass('content').text(self.message)
        ).append(
            date
        );
        
        return comment;
    }
    
    self.appendToPost = function () {
        $('.post').each(function (index, post) {
            if ($(post).data('post').id == self.post.id) {
                if ($(post).find('.comment').is(function (index) {
                    return $(this).data('comment').id == self.id;
                })) return;
                $(this).find('.comments').append(createDOM());
                return false;
            }
        });
    };
 }

function loadPosts(offset) {
    $.getJSON(URLS.post, {
        'limit': POSTS_LIMIT,
        'offset': offset
    }, function (data, textStatus, jqXHR) {
        $.each(data.objects, function (i, post) {
            new Post(post).addToBottom();
        });
    });
}

function Notification(data) {
    var self = this;
    $.extend(self, data);

    function createDOM() {
        var format = gettext("%(author)s commented on post.");
        var author = interpolate(format, {'author': self.comment.author.username}, true);

        var notification = $('<li/>').addClass('notification').bind('click', function (event) {
            if (!self.read) {
                $.ajax({
                    'type': 'PATCH',
                    'url': self.resource_uri,
                    'data': JSON.stringify({'read': true}),
                    'contentType': 'application/json',
                    'dataType': 'json',
                    'success': function (data, textStatus, jqXHR) {
                        self.read = true;
                        var unread_notifications_counter = 0;
                        $('.notification').each(function (i, notification) {
                            if (!$(notification).data('notification').read) {
                                unread_notifications_counter++;
                            }
                        });
                        $('#notifications_count').text(unread_notifications_counter);
                        notification.addClass('read_notification');
                    }
                });
            }
        });

        if (self.read) {
            notification.addClass('read_notification');
        }

        var date = $('<span/>').addClass('notification_element').addClass('notification_created_time');
        new Date(self.created_time).updatingNaturaltime(date);

        notification.data('notification', self).append(
            $('<span/>').addClass('notification_element').text(author)
        ).append(
            $('<span/>').addClass('notification_message').addClass('notification_element').text(self.comment.message)
        ).append(
            date
        );

        return notification;
    }

    function checkIfNotificationExists() {
        return $('.notification').is(function (index) {
            return $(this).data('notification').id == self.id;
        });
    }

    self.add = function () {
        if (checkIfNotificationExists()) return;

        if (!self.read) {
            $('#notifications_count').text(parseInt($('#notifications_count').text()) + 1);
        }
        $('#notifications_list').prepend(createDOM());
    };
}

function loadNotifications() {
    $.getJSON(URLS.notifications, function (data, textStatus, jqXHR) {
        $.each(data.objects, function (i, notification) {
            new Notification(notification).add();
        });
    });
}

// TODO: We should import url from Django not hardcode it
function buildCommentURL(post_id) {
    return URLS.post + post_id + '/comments/';
}

function addComment(comment, comment_url) {
    $.ajax({
        'type': 'POST',
        'url': comment_url,
        'data': JSON.stringify({'message': comment}),
        'contentType': 'application/json',
        'dataType': 'json',
        'success': function (data, textStatus, jqXHR) {
        }
    });
}

function autoShowIncomingPosts() {
    return $('#toggle_queue_checkbox').is(':checked');
}

function updateHiddenPostsCount() {
    var unread_count = $('ul > li.notShown').length;
    var format = ngettext("There is %(count)s new post", "There are %(count)s new posts", unread_count);
    var msg = interpolate(format, {'count': unread_count}, true);
    $('#posts_in_queue').text(msg);
}

function showHiddenPosts() {
    // TODO: Animation has to be considered and maybe improved
    $('ul > li.notShown').show('fast').removeClass('notShown');
}

$(document).ready(function () {
    initializePanels();

    // List of URIs of posts by user
    $('.posts').data('user_posts_URIs', []);

    $.updates.registerProcessor('home_channel', 'post_published', function (data) {
        new Post(data.post).addToTop();
    });

    $('.panel .header').click(function (event) {
        var collapsed = $(this).next().is(':visible');
        $(this).next('.content').slideToggle('fast');

        var name = $(this).parent().prop('id').substr('panel-'.length);

        $.post(URLS.panels_collapse, {
            'name': name,
            'collapsed': collapsed
        });
    });

    // TODO: Ajax request to store panels state is currently send many times while resizing, it should be send only at the end
    $(window).resize(function (event) {
        initializePanels();
    });

    // Saving text from post input box
    var input_box_text = $('#post_text').val();

    // Shows last updated posts, starting at offset 0, limited by POSTS_LIMIT
    loadPosts(0);

    $('#submit_post').click(function (event) {
        var message = $('#post_text').val();
        $(this).prop('disabled', true);
        var is_published = true;
        $.ajax({
            'type': 'POST',
            'url': URLS.post,
            'data': JSON.stringify({
                'message': message,
                'is_published': is_published
            }),
            'contentType': 'application/json',
            'dataType': 'json',
            'success': function (data, textStatus, jqXHR) {
                var full_post_uri = getLocation(jqXHR.getResponseHeader('location')).href;
                $('.posts').data('user_posts_URIs').push(full_post_uri);
                $('#post_text').val(input_box_text).css('min-height', 25);
            },
            'error': function (jqXHR, textStatus, errorThrown) {
                // There was an error, we enable form back
                $('#submit_post').prop('disabled', false);
            }
        });
    });

    $('#post_text').expandingTextArea().focus(function (event) {
        if ($(this).val() == input_box_text) {
            $(this).val('');
        }
        $(this).css('min-height', 50);
    }).blur(function (event) {
        if (!$(this).val().trim()) {
            $(this).val(input_box_text);
            $(this).css('min-height', 25);
        }
    }).keyup(function (event) {
        if (!$(this).val().trim()) {
            $('#submit_post').prop('disabled', true);
        }
        else {
            $('#submit_post').prop('disabled', false);
        }
    });

    $('#show_posts > input').click(function (event) {
        showHiddenPosts();
        $('#posts_in_queue, #show_posts, #toggle_queue').hide();
    });

    $('#toggle_queue > input').click(function (event) {
        if (autoShowIncomingPosts()) {
            showHiddenPosts();
            updateHiddenPostsCount();
        }
        else {
            $('#toggle_queue').hide();
        }
        $('#posts_in_queue, #show_posts').hide();
    });

    $(window).scroll(function (event) {
        if (document.body.scrollHeight - $(this).scrollTop() <= $(this).height()) {
            var last_post = $('.post:last').data('post');
            if (last_post) {
                loadPosts(last_post.id);
            }
        }
    });

    // Notifications
    $('#notifications_count').add('.close_notifications_box').click(function (event) {
        $('#notifications_box').slideToggle('fast');
    });

    $.updates.registerProcessor('user_channel', 'notification', function (data) {
        new Notification(data.notification).add();
    });

    loadNotifications();
});
