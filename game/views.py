from django.shortcuts import render
from django.http import JsonResponse
import json

def home(request):
    return render(request, 'game/home.html')

def game_view(request):
    return render(request, 'game/game.html')

def save_settings(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            # In a real app, you'd save to database or session
            # For now, we'll just return success
            return JsonResponse({'status': 'success'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)})
    return JsonResponse({'status': 'error', 'message': 'Invalid method'})