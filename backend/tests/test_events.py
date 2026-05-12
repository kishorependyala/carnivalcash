def test_events_list_create_and_delete_flow(client, seed_profile, auth_header):
    admin = seed_profile('5550000001', roles=['admin'])
    user = seed_profile('5550000002')

    create_response = client.post(
        '/api/events',
        json={
            'title': 'Parade starts',
            'description': 'Meet near the main stage',
            'type': 'schedule',
            'scheduledFor': '2026-05-10T11:30',
        },
        headers=auth_header(admin),
    )

    assert create_response.status_code == 201
    created = create_response.get_json()
    assert created['title'] == 'Parade starts'
    assert created['createdBy'] == admin['userId']

    list_response = client.get('/api/events', headers=auth_header(user))

    assert list_response.status_code == 200
    assert len(list_response.get_json()) == 1
    assert list_response.get_json()[0]['eventId'] == created['eventId']

    delete_response = client.delete(f"/api/events/{created['eventId']}", headers=auth_header(admin))
    empty_response = client.get('/api/events', headers=auth_header(user))

    assert delete_response.status_code == 200
    assert empty_response.get_json() == []


def test_events_are_admin_only_for_mutations(client, seed_profile, auth_header):
    user = seed_profile('5550000001')

    create_response = client.post('/api/events', json={'title': 'Hello'}, headers=auth_header(user))
    delete_response = client.delete('/api/events/does-not-exist', headers=auth_header(user))

    assert create_response.status_code == 403
    assert delete_response.status_code == 403
